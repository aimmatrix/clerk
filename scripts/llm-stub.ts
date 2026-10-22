/**
 * OpenAI-compatible stub. Returns a strict extraction for the three smoke
 * messages, and `{ data: [] }` on GET /models so /api/health can mark llm: true.
 */
import { createServer, type IncomingMessage, type ServerResponse } from 'node:http';

export interface LlmStub {
  url: string;
  close: () => Promise<void>;
}

export async function startLlmStub(): Promise<LlmStub> {
  const server = createServer((req, res) => {
    void handle(req, res).catch(() => {
      res.writeHead(500, { 'content-type': 'application/json' });
      res.end(JSON.stringify({ error: { message: 'stub failed' } }));
    });
  });
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  const address = server.address();
  if (!address || typeof address === 'string') throw new Error('llm stub failed to bind');
  return {
    url: `http://127.0.0.1:${address.port}/v1`,
    close: () => new Promise((resolve, reject) => server.close((err) => (err ? reject(err) : resolve()))),
  };
}

async function handle(req: IncomingMessage, res: ServerResponse): Promise<void> {
  const url = new URL(req.url ?? '/', 'http://127.0.0.1');
  if (req.method === 'GET' && url.pathname.endsWith('/models')) {
    json(res, 200, { object: 'list', data: [{ id: 'smoke' }] });
    return;
  }
  if (req.method === 'POST' && url.pathname.endsWith('/chat/completions')) {
    const body = await readBody(req);
    const haystack = JSON.stringify(body);
    json(res, 200, {
      id: 'chatcmpl-smoke',
      object: 'chat.completion',
      choices: [
        {
          index: 0,
          finish_reason: 'stop',
          message: { role: 'assistant', content: JSON.stringify({ items: itemsFor(haystack) }) },
        },
      ],
    });
    return;
  }
  json(res, 404, { error: { message: `no stub route ${url.pathname}` } });
}

function itemsFor(haystack: string): unknown[] {
  const text = haystack.toLowerCase();
  if (text.includes('pizza')) {
    return [
      item({
        type: 'task',
        title: 'Bring pizza for Thursday',
        summary: 'Ana will bring pizza for the meetup.',
        owner_name: 'Ana',
        priority: 'P1',
        confidence: 0.93,
        reasoning: 'Ana volunteers to bring pizza.',
      }),
    ];
  }
  if (text.includes('step-free') || text.includes('step free')) {
    return [
      item({
        type: 'question',
        title: 'Confirm step-free access',
        summary: 'A member asked whether the venue is step-free.',
        owner_name: null,
        priority: 'P2',
        confidence: 0.9,
        suggested_reply: 'Yes — the venue has step-free access from the street.',
        reasoning: 'Direct question about access.',
      }),
    ];
  }
  if (text.includes('venue') || text.includes('shoreditch')) {
    return [
      item({
        type: 'request',
        title: 'Find a venue for 60',
        summary: 'The meetup needs a Shoreditch venue for 60 people.',
        owner_name: null,
        priority: 'P0',
        confidence: 0.95,
        reasoning: 'Venue request for a large meetup.',
      }),
    ];
  }
  return [
    item({
      type: 'decision',
      title: 'Note the message',
      summary: 'Smoke fallback when the text matched no fixture.',
      owner_name: null,
      priority: 'P3',
      confidence: 0.8,
      reasoning: 'Unrecognised smoke message.',
    }),
  ];
}

function item(over: Record<string, unknown>): Record<string, unknown> {
  return {
    type: 'task',
    title: 'Follow up',
    summary: 'Follow up.',
    owner_name: null,
    priority: 'P2',
    due_at: null,
    confidence: 0.9,
    suggested_reply: null,
    event: null,
    reasoning: 'Smoke stub.',
    ...over,
  };
}

function json(res: ServerResponse, status: number, body: unknown): void {
  const payload = JSON.stringify(body);
  res.writeHead(status, { 'content-type': 'application/json', 'content-length': Buffer.byteLength(payload) });
  res.end(payload);
}

function readBody(req: IncomingMessage): Promise<unknown> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    req.on('data', (chunk) => chunks.push(Buffer.from(chunk)));
    req.on('end', () => {
      const text = Buffer.concat(chunks).toString('utf8');
      try {
        resolve(text ? JSON.parse(text) : {});
      } catch (error) {
        reject(error);
      }
    });
    req.on('error', reject);
  });
}
