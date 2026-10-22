/**
 * Tiny PostgREST stand-in so `scripts/smoke.ts` can exercise the real API routes
 * without a hosted Supabase project. Speaks the slice of the protocol that
 * `@supabase/supabase-js` and the post-back store actually use.
 */
import { createServer, type IncomingMessage, type ServerResponse } from 'node:http';
import { randomUUID } from 'node:crypto';

export type Row = Record<string, unknown>;

const RESERVED = new Set(['select', 'order', 'limit', 'offset', 'on_conflict']);

export interface FakeSupabase {
  url: string;
  close: () => Promise<void>;
  tables: Map<string, Row[]>;
}

export async function startFakeSupabase(seed?: (tables: Map<string, Row[]>) => void): Promise<FakeSupabase> {
  const tables = new Map<string, Row[]>();
  for (const name of ['communities', 'messages', 'items', 'item_events', 'failures']) {
    tables.set(name, []);
  }
  seed?.(tables);

  const server = createServer((req, res) => {
    void handle(req, res, tables).catch((error: unknown) => {
      const message = error instanceof Error ? error.message : 'fake supabase failed';
      send(res, 500, { message, code: 'FAKE' });
    });
  });

  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  const address = server.address();
  if (!address || typeof address === 'string') throw new Error('fake supabase failed to bind');
  return {
    url: `http://127.0.0.1:${address.port}`,
    tables,
    close: () => new Promise((resolve, reject) => server.close((err) => (err ? reject(err) : resolve()))),
  };
}

async function handle(req: IncomingMessage, res: ServerResponse, tables: Map<string, Row[]>): Promise<void> {
  const url = new URL(req.url ?? '/', 'http://127.0.0.1');
  const match = url.pathname.match(/^\/rest\/v1\/([a-z_]+)$/);
  if (!match) {
    send(res, 404, { message: `no route ${url.pathname}`, code: 'PGRST000' });
    return;
  }
  const key = req.headers.apikey;
  if (!key) {
    send(res, 401, { message: 'missing apikey', code: 'PGRST301' });
    return;
  }

  const table = tables.get(match[1]);
  if (!table) {
    send(res, 404, { message: `table ${match[1]}`, code: 'PGRST205' });
    return;
  }

  const method = req.method ?? 'GET';
  const params = url.searchParams;
  const prefer = String(req.headers.prefer ?? '');
  const wantsObject = String(req.headers.accept ?? '').includes('application/vnd.pgrst.object+json');
  const body = method === 'GET' || method === 'DELETE' ? null : await readBody(req);

  if (method === 'GET') {
    let rows = applyFilters(table, params);
    rows = applyOrder(rows, params);
    const limitRaw = params.get('limit');
    if (limitRaw != null) {
      const limit = Number(limitRaw);
      if (Number.isFinite(limit) && limit >= 0) rows = rows.slice(0, limit);
    }
    const shaped = rows.map((row) => shape(row, params.get('select'), tables));
    reply(res, shaped, wantsObject);
    return;
  }

  if (method === 'DELETE') {
    const keep: Row[] = [];
    for (const row of table) {
      if (matches(row, params)) continue;
      keep.push(row);
    }
    table.splice(0, table.length, ...keep);
    send(res, 204, null);
    return;
  }

  if (method === 'POST') {
    const incoming = asRows(body);
    const conflict = (params.get('on_conflict') ?? '')
      .split(',')
      .map((part) => part.trim())
      .filter(Boolean);
    const upsert = prefer.includes('resolution=merge-duplicates') && conflict.length > 0;
    const stored: Row[] = [];
    for (const raw of incoming) {
      const row = stamp(raw, true);
      if (upsert) {
        const index = table.findIndex((existing) => conflict.every((column) => existing[column] === row[column]));
        if (index >= 0) {
          table[index] = stamp({ ...table[index], ...row, id: table[index].id }, false);
          stored.push(table[index]);
          continue;
        }
      }
      if (row.id == null) row.id = randomUUID();
      table.push(row);
      stored.push(row);
    }
    if (!prefer.includes('return=representation')) {
      send(res, 201, null);
      return;
    }
    const shaped = stored.map((row) => shape(row, params.get('select'), tables));
    reply(res, shaped, wantsObject, 201);
    return;
  }

  if (method === 'PATCH') {
    const patch = asObject(body);
    const updated: Row[] = [];
    for (let i = 0; i < table.length; i += 1) {
      if (!matches(table[i], params)) continue;
      table[i] = stamp({ ...table[i], ...patch }, false);
      updated.push(table[i]);
    }
    if (!prefer.includes('return=representation')) {
      send(res, 204, null);
      return;
    }
    const shaped = updated.map((row) => shape(row, params.get('select'), tables));
    reply(res, shaped, wantsObject);
    return;
  }

  send(res, 405, { message: `method ${method}`, code: 'PGRST000' });
}

function reply(res: ServerResponse, rows: Row[], wantsObject: boolean, status = 200): void {
  if (wantsObject) {
    if (rows.length === 1) {
      send(res, status, rows[0]);
      return;
    }
    send(res, 406, {
      code: 'PGRST116',
      message: rows.length === 0 ? 'JSON object requested, multiple (or no) rows returned' : 'multiple rows',
      details: null,
    });
    return;
  }
  send(res, status, rows);
}

function applyFilters(rows: Row[], params: URLSearchParams): Row[] {
  return rows.filter((row) => matches(row, params));
}

function matches(row: Row, params: URLSearchParams): boolean {
  for (const [key, value] of params) {
    if (RESERVED.has(key)) continue;
    const eq = /^eq\.(.*)$/s.exec(value);
    if (!eq) continue;
    const expected = eq[1];
    const actual = row[key];
    if (expected === 'null') {
      if (actual != null) return false;
      continue;
    }
    if (String(actual ?? '') !== expected) return false;
  }
  return true;
}

function applyOrder(rows: Row[], params: URLSearchParams): Row[] {
  const specs = params
    .getAll('order')
    .flatMap((value) => value.split(','))
    .map((part) => part.trim())
    .filter(Boolean);
  if (!specs.length) return rows;
  const copy = [...rows];
  copy.sort((a, b) => {
    for (const spec of specs) {
      const [column, direction] = spec.split('.');
      const av = a[column];
      const bv = b[column];
      if (av === bv) continue;
      const cmp = String(av ?? '') < String(bv ?? '') ? -1 : 1;
      return direction === 'desc' ? -cmp : cmp;
    }
    return 0;
  });
  return copy;
}

function shape(row: Row, select: string | null, tables: Map<string, Row[]>): Row {
  if (!select || select === '*') return { ...row };
  const embed = /messages\(([^)]*)\)/.exec(select);
  const next: Row = select.trim().startsWith('*') ? { ...row } : pick(row, select);
  if (embed && row.message_id) {
    const message = (tables.get('messages') ?? []).find((candidate) => candidate.id === row.message_id);
    const fields = embed[1].split(',').map((part) => part.trim());
    next.messages = message ? pick(message, fields.join(',')) : null;
  } else if (embed) {
    next.messages = null;
  }
  return next;
}

function pick(row: Row, columns: string): Row {
  const names = columns
    .replace(/messages\([^)]*\)/g, '')
    .split(',')
    .map((part) => part.trim())
    .filter((part) => part && part !== '*');
  if (!names.length) return { ...row };
  const out: Row = {};
  for (const name of names) out[name] = row[name] ?? null;
  return out;
}

function stamp(row: Row, isInsert: boolean): Row {
  const now = new Date().toISOString();
  const next = { ...row };
  if (isInsert && next.created_at == null) next.created_at = now;
  if (next.updated_at == null || !isInsert) next.updated_at = now;
  return next;
}

function asRows(body: unknown): Row[] {
  if (Array.isArray(body)) return body.map(asObject);
  return [asObject(body)];
}

function asObject(body: unknown): Row {
  if (!body || typeof body !== 'object' || Array.isArray(body)) return {};
  return { ...(body as Row) };
}

function readBody(req: IncomingMessage): Promise<unknown> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    req.on('data', (chunk) => chunks.push(Buffer.from(chunk)));
    req.on('end', () => {
      const text = Buffer.concat(chunks).toString('utf8').trim();
      if (!text) {
        resolve(null);
        return;
      }
      try {
        resolve(JSON.parse(text));
      } catch (error) {
        reject(error);
      }
    });
    req.on('error', reject);
  });
}

function send(res: ServerResponse, status: number, body: unknown): void {
  const payload = body == null ? '' : JSON.stringify(body);
  res.writeHead(status, {
    'content-type': 'application/json',
    'content-length': Buffer.byteLength(payload),
  });
  res.end(payload);
}
