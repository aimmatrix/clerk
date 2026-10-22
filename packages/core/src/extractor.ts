import { buildMessages, londonLocalToUtc } from './prompt';
import type { ChatMessage } from './prompt';
import { EXTRACTION_JSON_SCHEMA, extractionResponseSchema } from './schema';
import type { ParsedExtractedItem } from './schema';
import { CONFIDENCE_THRESHOLD } from './types';
import type { ExtractedItem, FailureReason, IncomingMessage, IngestRequest } from './types';

/* -------------------------------------------------------------------------- */
/* Public types                                                                */
/* -------------------------------------------------------------------------- */

export interface ExtractOptions {
  /** Defaults to `LLM_BASE_URL`, then `https://api.openai.com/v1`. */
  baseUrl?: string;
  /** Defaults to `LLM_API_KEY`. Optional for local providers such as Ollama. */
  apiKey?: string;
  /** Defaults to `LLM_MODEL`, then `gpt-4o-mini`. */
  model?: string;
  /** Defaults to `CONFIDENCE_THRESHOLD` env, then 0.6. */
  threshold?: number;
  /** Per-request timeout. Default 25 000 ms. */
  timeoutMs?: number;
  /** Sampling temperature; `null` omits the parameter. Default 0. */
  temperature?: number | null;
  /** Pause before retrying a transient failure. Default 300 ms. */
  retryDelayMs?: number;
  /** Injected fetch (tests). Defaults to the global. */
  fetch?: typeof fetch;
  /** Reference time for date resolution. Defaults to the message's `sentAt`. */
  now?: Date;
}

export interface ExtractFailure {
  reason: FailureReason;
  /**
   * Diagnostic payload stored in `failures.raw`.
   * - `low_confidence`: `{ confidence, threshold, items }` (rejected items, `confidence` = lowest).
   * - `ambiguous_owner`: `{ claimedOwners, itemsKept: true }`. The item itself is still returned, owner nulled.
   * - `invalid_json` / `llm_error`: what the provider returned.
   */
  raw: unknown;
}

export interface ExtractMeta {
  model: string;
  mode: ResponseMode;
  attempts: number;
  latencyMs: number;
}

export interface ExtractResult {
  items: ExtractedItem[];
  failure?: ExtractFailure;
  meta?: ExtractMeta;
}

export type ResponseMode = 'json_schema' | 'json_object' | 'plain';

/* -------------------------------------------------------------------------- */
/* Configuration                                                               */
/* -------------------------------------------------------------------------- */

const DEFAULT_BASE_URL = 'https://api.openai.com/v1';
const DEFAULT_MODEL = 'gpt-4o-mini';
const DEFAULT_TIMEOUT_MS = 25_000;
const DEFAULT_RETRY_DELAY_MS = 300;
const MAX_ATTEMPTS = 2;
const MAX_ITEMS = 5;
const MAX_TITLE = 80;
const MODES: ResponseMode[] = ['json_schema', 'json_object', 'plain'];

/** Remembers when a provider has rejected a response format so we only pay for that once. */
const modeCache = new Map<string, number>();

export function resetExtractorCache(): void {
  modeCache.clear();
}

function env(name: string): string | undefined {
  if (typeof process === 'undefined' || !process.env) return undefined;
  const value = process.env[name];
  return value && value.trim() ? value.trim() : undefined;
}

function pick(...values: Array<string | undefined>): string | undefined {
  for (const v of values) if (v && v.trim()) return v.trim();
  return undefined;
}

interface ResolvedConfig {
  baseUrl: string;
  apiKey?: string;
  model: string;
  threshold: number;
  timeoutMs: number;
  temperature: number | null;
  retryDelayMs: number;
  fetchImpl: typeof fetch;
}

function resolveConfig(opts: ExtractOptions): ResolvedConfig {
  const envThreshold = Number(env('CONFIDENCE_THRESHOLD'));
  const threshold =
    opts.threshold ??
    (env('CONFIDENCE_THRESHOLD') !== undefined && envThreshold >= 0 && envThreshold <= 1
      ? envThreshold
      : CONFIDENCE_THRESHOLD);
  return {
    baseUrl: (pick(opts.baseUrl, env('LLM_BASE_URL')) ?? DEFAULT_BASE_URL).replace(/\/+$/, ''),
    apiKey: pick(opts.apiKey, env('LLM_API_KEY')),
    model: pick(opts.model, env('LLM_MODEL')) ?? DEFAULT_MODEL,
    threshold,
    timeoutMs: opts.timeoutMs ?? DEFAULT_TIMEOUT_MS,
    temperature: opts.temperature === undefined ? 0 : opts.temperature,
    retryDelayMs: opts.retryDelayMs ?? DEFAULT_RETRY_DELAY_MS,
    fetchImpl: opts.fetch ?? globalThis.fetch,
  };
}

/* -------------------------------------------------------------------------- */
/* LLM transport                                                               */
/* -------------------------------------------------------------------------- */

type LlmOutcome =
  | { ok: true; content: string; finishReason: string | null }
  | { ok: false; transient: boolean; raw: unknown };

interface TransportState {
  modeIndex: number;
  temperature: number | null;
}

function buildBody(cfg: ResolvedConfig, messages: ChatMessage[], state: TransportState) {
  const body: Record<string, unknown> = { model: cfg.model, messages };
  if (state.temperature !== null) body.temperature = state.temperature;
  const mode = MODES[state.modeIndex];
  if (mode === 'json_schema') {
    body.response_format = { type: 'json_schema', json_schema: EXTRACTION_JSON_SCHEMA };
  } else if (mode === 'json_object') {
    body.response_format = { type: 'json_object' };
  }
  return body;
}

function rejectsResponseFormat(status: number, body: string): boolean {
  if (status !== 400 && status !== 404 && status !== 422) return false;
  return /response_format|json_schema|json schema|structured|schema|json_object/i.test(body);
}

function rejectsTemperature(status: number, body: string): boolean {
  return (status === 400 || status === 422) && /temperature/i.test(body);
}

function messageText(message: unknown): { text: string; refusal?: string } {
  const m = (message ?? {}) as { content?: unknown; refusal?: unknown };
  let text = '';
  if (typeof m.content === 'string') {
    text = m.content;
  } else if (Array.isArray(m.content)) {
    text = m.content
      .map((part) => (typeof part === 'string' ? part : ((part as { text?: string })?.text ?? '')))
      .join('');
  }
  const refusal = typeof m.refusal === 'string' && m.refusal ? m.refusal : undefined;
  return { text, refusal };
}

async function complete(
  cfg: ResolvedConfig,
  messages: ChatMessage[],
  state: TransportState,
  cacheKey: string,
): Promise<LlmOutcome> {
  const url = `${cfg.baseUrl}/chat/completions`;
  const headers: Record<string, string> = { 'content-type': 'application/json' };
  if (cfg.apiKey) headers.authorization = `Bearer ${cfg.apiKey}`;

  // Each iteration either returns or downgrades a capability, so this is bounded.
  for (let guard = 0; guard < MODES.length + 2; guard += 1) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), cfg.timeoutMs);
    let status = 0;
    let bodyText = '';
    try {
      const response = await cfg.fetchImpl(url, {
        method: 'POST',
        headers,
        body: JSON.stringify(buildBody(cfg, messages, state)),
        signal: controller.signal,
      });
      status = response.status;
      bodyText = await response.text();
    } catch (error) {
      return {
        ok: false,
        transient: true,
        raw: { error: error instanceof Error ? error.message : String(error) },
      };
    } finally {
      clearTimeout(timer);
    }

    if (status < 200 || status >= 300) {
      if (rejectsTemperature(status, bodyText) && state.temperature !== null) {
        state.temperature = null;
        continue;
      }
      if (state.modeIndex < MODES.length - 1 && rejectsResponseFormat(status, bodyText)) {
        state.modeIndex += 1;
        modeCache.set(cacheKey, state.modeIndex);
        continue;
      }
      return {
        ok: false,
        transient: status === 408 || status === 429 || status >= 500,
        raw: { status, body: bodyText.slice(0, 500) },
      };
    }

    let envelope: unknown;
    try {
      envelope = JSON.parse(bodyText);
    } catch {
      return { ok: false, transient: false, raw: { status, body: bodyText.slice(0, 500) } };
    }
    const choice = (envelope as { choices?: Array<{ message?: unknown; finish_reason?: string }> })
      .choices?.[0];
    if (!choice) {
      return { ok: false, transient: false, raw: { error: 'no choices in response', envelope } };
    }
    const { text, refusal } = messageText(choice.message);
    if (refusal) {
      return { ok: false, transient: false, raw: { refusal } };
    }
    return { ok: true, content: text, finishReason: choice.finish_reason ?? null };
  }
  return { ok: false, transient: false, raw: { error: 'provider rejected every response format' } };
}

/* -------------------------------------------------------------------------- */
/* Parsing                                                                     */
/* -------------------------------------------------------------------------- */

type ParseOutcome = { ok: true; items: ParsedExtractedItem[] } | { ok: false; error: string };

function stripWrappers(content: string): string {
  let text = content.replace(/<think>[\s\S]*?<\/think>/gi, '').trim();
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fenced) text = fenced[1].trim();
  return text;
}

function parseJsonLoose(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    const start = text.indexOf('{');
    const end = text.lastIndexOf('}');
    if (start !== -1 && end > start) return JSON.parse(text.slice(start, end + 1));
    throw new Error('response is not valid JSON');
  }
}

/** Gentle repairs for providers that do not enforce the schema. Anything else fails validation. */
function coerce(value: unknown): unknown {
  const root = Array.isArray(value) ? { items: value } : value;
  if (!root || typeof root !== 'object') return root;
  const items = (root as { items?: unknown }).items;
  if (!Array.isArray(items)) return root;
  return {
    ...root,
    items: items.map((raw) => {
      if (!raw || typeof raw !== 'object') return raw;
      const item = { ...(raw as Record<string, unknown>) };
      if (typeof item.type === 'string') item.type = item.type.trim().toLowerCase();
      if (typeof item.priority === 'string') item.priority = item.priority.trim().toUpperCase();
      if (typeof item.confidence === 'string') item.confidence = Number(item.confidence);
      // "85" almost certainly means 85%; 1.7 is just wrong and must fail validation.
      if (typeof item.confidence === 'number' && item.confidence >= 2 && item.confidence <= 100) {
        item.confidence = item.confidence / 100;
      }
      return item;
    }),
  };
}

function parseResponse(content: string): ParseOutcome {
  const text = stripWrappers(content);
  if (!text) return { ok: false, error: 'empty response' };
  let json: unknown;
  try {
    json = parseJsonLoose(text);
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : 'invalid JSON' };
  }
  const result = extractionResponseSchema.safeParse(coerce(json));
  if (!result.success) {
    const issues = result.error.issues
      .slice(0, 5)
      .map((i) => `${i.path.join('.') || '(root)'}: ${i.message}`)
      .join('; ');
    return { ok: false, error: `schema validation failed: ${issues}` };
  }
  return { ok: true, items: result.data.items };
}

/* -------------------------------------------------------------------------- */
/* Post-processing                                                             */
/* -------------------------------------------------------------------------- */

/** Model numeric London offsets are wall times; recompute DST for the target date. Explicit Z remains UTC. */
export function normaliseWhen(value: string | null | undefined): string | null {
  if (!value) return null;
  const text = value.trim();
  if (!text || /^(null|none|n\/a|tbc|tbd)$/i.test(text)) return null;

  let date: Date | null = null;
  const dateOnly = text.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  const local = text.match(/^(\d{4})-(\d{2})-(\d{2})[T ](\d{2}):(\d{2})(?::(\d{2}))?(?:\.\d+)?(?:\+0[01]:00)?$/);
  if (dateOnly) {
    date = londonLocalToUtc(Number(dateOnly[1]), Number(dateOnly[2]), Number(dateOnly[3]), 18, 0);
  } else if (local) {
    date = londonLocalToUtc(
      Number(local[1]),
      Number(local[2]),
      Number(local[3]),
      Number(local[4]),
      Number(local[5]),
      Number(local[6] ?? 0),
    );
  } else {
    const parsed = new Date(text);
    date = Number.isNaN(parsed.getTime()) ? null : parsed;
  }
  if (!date || Number.isNaN(date.getTime())) return null;
  const year = date.getUTCFullYear();
  if (year < 2000 || year > 2100) return null;
  return date.toISOString();
}

const NON_OWNERS = new Set([
  'someone', 'somebody', 'anyone', 'anybody', 'everyone', 'everybody', 'nobody', 'unassigned',
  'unknown', 'none', 'null', 'n/a', 'na', 'tbc', 'tbd', 'me', 'i', 'we', 'us', 'you', 'he', 'she',
  'they', 'him', 'her', 'them', 'team', 'the team', 'organisers', 'organizers', 'the organisers',
  'the organizers', 'volunteer', 'a volunteer', 'admin', 'admins', 'mods',
]);

function normaliseText(value: string): string {
  return value
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/['’`]/g, ' ')
    .replace(/[^\p{L}\p{N}\s-]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function ownerSupported(owner: string, haystack: string): boolean {
  const name = normaliseText(owner);
  if (!name) return false;
  const padded = ` ${haystack} `;
  if (padded.includes(` ${name} `)) return true;
  const first = name.split(' ')[0];
  return first.length >= 2 && padded.includes(` ${first} `);
}

function ownerHaystack(message: IncomingMessage, context: IncomingMessage[]): string {
  const parts = [message.authorName, message.content];
  for (const m of context) parts.push(m.authorName, m.content);
  return normaliseText(parts.join(' \n '));
}

function clipTitle(title: string): string {
  const clean = title.replace(/\s+/g, ' ').trim();
  return clean.length > MAX_TITLE ? `${clean.slice(0, MAX_TITLE - 1).trimEnd()}…` : clean;
}

interface Finalised {
  item: ExtractedItem;
  droppedOwner?: string;
}

function finalise(parsed: ParsedExtractedItem, haystack: string): Finalised {
  let ownerName = parsed.owner_name?.trim() || null;
  let droppedOwner: string | undefined;
  if (ownerName && NON_OWNERS.has(normaliseText(ownerName))) {
    ownerName = null;
  } else if (ownerName && !ownerSupported(ownerName, haystack)) {
    droppedOwner = ownerName;
    ownerName = null;
  }

  const dueAt = normaliseWhen(parsed.due_at);
  let event: ExtractedItem['event'] = null;
  if (parsed.event && (parsed.type === 'event' || parsed.type === 'decision')) {
    const start = normaliseWhen(parsed.event.start);
    let end = normaliseWhen(parsed.event.end);
    if (start && end && new Date(end) <= new Date(start)) end = null;
    const location = parsed.event.location?.trim() || null;
    if (start || end || location) event = { start, end, location };
  }

  const reply = parsed.suggested_reply?.trim() || null;
  const base: ExtractedItem = {
    type: parsed.type,
    title: clipTitle(parsed.title),
    summary: parsed.summary.trim(),
    owner_name: ownerName,
    priority: parsed.priority,
    due_at: dueAt,
    confidence: parsed.confidence,
    suggested_reply: parsed.type === 'question' ? reply : null,
    event,
    reasoning: parsed.reasoning.trim(),
  };

  if (base.type === 'event' && !base.due_at && base.event?.start) base.due_at = base.event.start;
  if (base.type === 'noise') {
    return {
      item: { ...base, owner_name: null, priority: 'P3', due_at: null, suggested_reply: null, event: null },
    };
  }
  return { item: base, droppedOwner };
}

/* -------------------------------------------------------------------------- */
/* extract()                                                                   */
/* -------------------------------------------------------------------------- */

function sleep(ms: number): Promise<void> {
  return ms > 0 ? new Promise((resolve) => setTimeout(resolve, ms)) : Promise.resolve();
}

export async function extract(input: IngestRequest, opts: ExtractOptions = {}): Promise<ExtractResult> {
  const startedAt = Date.now();
  const cfg = resolveConfig(opts);

  if (!input.message.content || !input.message.content.trim()) {
    return {
      items: [],
      failure: { reason: 'unsupported', raw: { message: 'empty message content' } },
    };
  }

  const cacheKey = `${cfg.baseUrl}|${cfg.model}`;
  const state: TransportState = { modeIndex: modeCache.get(cacheKey) ?? 0, temperature: cfg.temperature };
  const messages = buildMessages(input, { now: opts.now });
  const haystack = ownerHaystack(input.message, input.context ?? []);

  let failure: ExtractFailure | undefined;
  let attempts = 0;

  while (attempts < MAX_ATTEMPTS) {
    attempts += 1;
    const outcome = await complete(cfg, messages, state, cacheKey);

    if (!outcome.ok) {
      failure = { reason: 'llm_error', raw: outcome.raw };
      if (!outcome.transient) break;
      await sleep(cfg.retryDelayMs);
      continue;
    }

    const parsed = parseResponse(outcome.content);
    if (!parsed.ok) {
      failure = {
        reason: 'invalid_json',
        raw: { error: parsed.error, finishReason: outcome.finishReason, content: outcome.content.slice(0, 1000) },
      };
      messages.push(
        { role: 'assistant', content: outcome.content.slice(0, 2000) },
        {
          role: 'user',
          content: `That reply was rejected: ${parsed.error}. Reply again with ONLY one valid JSON object of the form {"items":[…]} using exactly the specified keys.`,
        },
      );
      continue;
    }

    const finalised = parsed.items.slice(0, MAX_ITEMS).map((p) => finalise(p, haystack));
    const kept: ExtractedItem[] = [];
    const rejected: ExtractedItem[] = [];
    const droppedOwners: string[] = [];
    for (const { item, droppedOwner } of finalised) {
      if (item.confidence < cfg.threshold) {
        rejected.push(item);
      } else {
        kept.push(item);
        if (droppedOwner) droppedOwners.push(droppedOwner);
      }
    }

    let result: ExtractFailure | undefined;
    if (rejected.length) {
      result = {
        reason: 'low_confidence',
        raw: {
          confidence: Math.min(...rejected.map((i) => i.confidence)),
          threshold: cfg.threshold,
          items: rejected,
        },
      };
    } else if (droppedOwners.length) {
      result = { reason: 'ambiguous_owner', raw: { claimedOwners: droppedOwners, itemsKept: true } };
    }

    return {
      items: kept,
      ...(result ? { failure: result } : {}),
      meta: {
        model: cfg.model,
        mode: MODES[state.modeIndex],
        attempts,
        latencyMs: Date.now() - startedAt,
      },
    };
  }

  return {
    items: [],
    failure: failure ?? { reason: 'llm_error', raw: { error: 'extraction did not run' } },
    meta: {
      model: cfg.model,
      mode: MODES[state.modeIndex],
      attempts,
      latencyMs: Date.now() - startedAt,
    },
  };
}
