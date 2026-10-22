import type {
  ExtractedItem,
  Failure,
  FailureReason,
  IncomingMessage,
  IngestRequest,
  IngestResponse,
  Item,
  ItemType,
  Priority,
  SimScriptStep,
} from '@clerk/core';
import { localUrgency } from './local-rank';

// Literal `process.env.NEXT_PUBLIC_*` reads so Next inlines them into the client bundle.
export const OFFLINE = process.env.NEXT_PUBLIC_SIMULATOR_OFFLINE === '1';
export const COMMUNITY_ID =
  process.env.NEXT_PUBLIC_DEMO_COMMUNITY_ID ?? '00000000-0000-0000-0000-000000000001';
const CONFIDENCE_THRESHOLD = Number(process.env.NEXT_PUBLIC_CONFIDENCE_THRESHOLD ?? '0.6');
const API_TIMEOUT_MS = 35000;

/** An item as the simulator board holds it: the contract Item plus where it came from. */
export interface SimItem extends Item {
  sourceExternalId: string;
  /** Source message text/author, kept for the card's quote line. */
  sourceText: string;
  sourceAuthor: string;
  /** Simulated clock for this item (when the source message was sent) — used for "due Thu". */
  sentAt: string;
  via: 'api' | 'cached';
}

export interface SimFailure extends Failure {
  sourceExternalId: string;
}

export type Chip =
  | { kind: 'item'; type: ItemType; priority: Priority }
  | { kind: 'noise' }
  | { kind: 'failure'; reason: FailureReason };

export interface StepResult {
  items: SimItem[];
  failures: SimFailure[];
  noise: number;
  chips: Chip[];
  /** True when the live API was expected but we fell back to cached extractions. */
  degraded: boolean;
}

/** Same rule as C11's buildContext, simplified: same thread first, then the latest messages. */
export function recentContext(message: IncomingMessage, history: IncomingMessage[], max = 5): IncomingMessage[] {
  const sameThread = message.threadId ? history.filter((m) => m.threadId === message.threadId) : [];
  const rest = history.filter((m) => !sameThread.includes(m));
  return [...sameThread, ...rest.slice(-max)].slice(-max);
}

async function ingest(step: SimScriptStep, context: IncomingMessage[]): Promise<IngestResponse> {
  const body: IngestRequest = {
    communityId: COMMUNITY_ID,
    message: { ...step.message, source: 'simulator' },
    context,
  };
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), API_TIMEOUT_MS);
  try {
    const res = await fetch('/api/ingest', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
      },
      body: JSON.stringify(body),
      signal: controller.signal,
    });
    if (!res.ok) throw new Error(`ingest ${res.status}`);
    const json = (await res.json()) as Partial<IngestResponse>;
    if (!Array.isArray(json.items) || !Array.isArray(json.failures)) throw new Error('bad ingest shape');
    return json as IngestResponse;
  } finally {
    clearTimeout(timer);
  }
}

function toChips(items: SimItem[], failures: SimFailure[], noise: number): Chip[] {
  const chips: Chip[] = [
    ...items.map((i): Chip => ({ kind: 'item', type: i.type, priority: i.priority })),
    ...failures.map((f): Chip => ({ kind: 'failure', reason: f.reason })),
  ];
  if (noise > 0 || chips.length === 0) chips.push({ kind: 'noise' });
  return chips;
}

function fromApi(step: SimScriptStep, res: IngestResponse): StepResult {
  const visible = res.items.filter((i) => i.type !== 'noise');
  const noise = res.items.length - visible.length;
  const items: SimItem[] = visible.map((i) => ({
    ...i,
    sourceExternalId: step.message.externalId,
    sourceText: step.message.content,
    sourceAuthor: step.message.authorName,
    sentAt: step.message.sentAt,
    via: 'api',
  }));
  const failures: SimFailure[] = res.failures.map((f) => ({
    ...f,
    messageContent: f.messageContent ?? step.message.content,
    authorName: f.authorName ?? step.message.authorName,
    sourceExternalId: step.message.externalId,
  }));
  return { items, failures, noise, chips: toChips(items, failures, noise), degraded: false };
}

function cachedFailure(step: SimScriptStep, reason: FailureReason, confidence: number | null, raw: unknown, i: number): SimFailure {
  return {
    id: `sim-fail-${step.message.externalId}-${i}`,
    communityId: COMMUNITY_ID,
    messageId: `msg-${step.message.externalId}`,
    reason,
    confidence,
    raw,
    claimedBy: null,
    createdAt: new Date().toISOString(),
    messageContent: step.message.content,
    authorName: step.message.authorName,
    sourceExternalId: step.message.externalId,
  };
}

function fromCached(step: SimScriptStep, degraded: boolean): StepResult {
  const now = new Date(step.message.sentAt);
  const stamp = new Date().toISOString();
  const items: SimItem[] = [];
  const failures: SimFailure[] = [];
  let noise = 0;

  const extracted: ExtractedItem[] = step.cachedItems ?? [];
  if (extracted.length === 0) {
    // Nothing cached and no API: say so honestly instead of silently dropping the message.
    failures.push(cachedFailure(step, degraded ? 'llm_error' : 'unsupported', null, null, 0));
  }

  extracted.forEach((e, i) => {
    if (e.type === 'noise') {
      noise += 1;
    } else if (e.confidence < CONFIDENCE_THRESHOLD) {
      failures.push(cachedFailure(step, 'low_confidence', e.confidence, e, i));
    } else {
      items.push({
        id: `sim-item-${step.message.externalId}-${i}`,
        communityId: COMMUNITY_ID,
        messageId: `msg-${step.message.externalId}`,
        type: e.type,
        title: e.title,
        summary: e.summary || null,
        ownerName: e.owner_name,
        priority: e.priority,
        dueAt: e.due_at,
        confidence: e.confidence,
        urgencyScore: localUrgency(e, now),
        status: 'pending',
        suggestedReply: e.suggested_reply,
        eventStart: e.event?.start ?? null,
        eventEnd: e.event?.end ?? null,
        eventLocation: e.event?.location ?? null,
        sourceLink: step.message.permalink ?? null,
        createdAt: stamp,
        updatedAt: stamp,
        sourceExternalId: step.message.externalId,
        sourceText: step.message.content,
        sourceAuthor: step.message.authorName,
        sentAt: step.message.sentAt,
        via: 'cached',
      });
    }
  });

  return { items, failures, noise, chips: toChips(items, failures, noise), degraded };
}

/** Live pipeline first; cached extractions if offline or if the API errors/times out. */
export async function processStep(step: SimScriptStep, context: IncomingMessage[]): Promise<StepResult> {
  if (OFFLINE) return fromCached(step, false);
  try {
    return fromApi(step, await ingest(step, context));
  } catch {
    return fromCached(step, true);
  }
}

const syncQueue = new Map<string, Promise<unknown>>();

/**
 * Best-effort calls to the real API for review actions. The board state is the source of truth.
 * Calls are chained per item so a quick Approve → Post can't reach the server out of order
 * (the post route returns 409 unless the item is already approved).
 */
export function syncReview(item: SimItem, action: 'approve' | 'post' | 'done' | 'reject'): void {
  if (OFFLINE || item.via !== 'api') return;
  const json = { 'content-type': 'application/json' };
  const actor = 'simulator';
  const call = () =>
    action === 'post'
      ? fetch(`/api/items/${item.id}/post`, { method: 'POST', headers: json, body: JSON.stringify({ actor }) })
      : fetch(`/api/items/${item.id}`, { method: 'PATCH', headers: json, body: JSON.stringify({ action, actor }) });
  const next = (syncQueue.get(item.id) ?? Promise.resolve()).then(call, call).catch(() => undefined);
  syncQueue.set(item.id, next);
}

export function resetRemote(): void {
  if (OFFLINE) return;
  fetch('/api/simulator/reset', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ communityId: COMMUNITY_ID }),
  }).catch(() => undefined);
}
