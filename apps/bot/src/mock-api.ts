/**
 * In-process stand-in for the web API (X3) when `/api/ingest` is not ready.
 * Heuristic only — never posts to Discord. State lives in this process.
 */
import {
  CONFIDENCE_THRESHOLD,
  buildDigest,
  rankUrgency,
  type Digest,
  type Failure,
  type IncomingMessage,
  type IngestRequest,
  type IngestResponse,
  type Item,
  type ItemType,
  type Priority,
} from '@clerk/core';

export interface HealthResponse {
  ok: boolean;
  llm: boolean;
  db: boolean;
}

interface Store {
  items: Item[];
  failures: Failure[];
}

const store: Store = { items: [], failures: [] };

function titleFrom(content: string): string {
  const compact = content.replace(/\s+/g, ' ').trim();
  if (!compact) return 'Untitled';
  return compact.length <= 80 ? compact : `${compact.slice(0, 77)}…`;
}

function inferType(content: string): ItemType {
  const text = content.toLowerCase();
  if (!text.trim()) return 'noise';
  if (/^(lol|lmao|haha|😂|💀|🔥)+\s*$/i.test(content.trim())) return 'noise';
  if (/\?/.test(content) || /\b(anyone know|is there|can we|how do)\b/i.test(content)) return 'question';
  if (/\b(meetup|event|tonight|calendar|ics)\b/i.test(text)) return 'event';
  if (/\b(decided|we're going with|moving to|instead of)\b/i.test(text)) return 'decision';
  if (/\b(i'll|i will|i can|i'll grab|leaving this with me)\b/i.test(text)) return 'task';
  if (/\b(need|looking for|can someone|venue|sponsor|please)\b/i.test(text)) return 'request';
  return 'task';
}

function inferOwner(message: IncomingMessage, type: ItemType): string | null {
  if (type === 'task' && /\b(i'll|i will|i can)\b/i.test(message.content)) return message.authorName;
  const named = message.content.match(/\b(?:@)?([A-Z][a-z]{1,20})\b/);
  if (named && named[1] && named[1] !== 'I') return named[1];
  return null;
}

function inferPriority(content: string, type: ItemType): Priority {
  if (/\b(urgent|asap|tonight|p0)\b/i.test(content) || type === 'request') return 'P0';
  if (type === 'question') return 'P1';
  if (type === 'noise') return 'P3';
  return 'P2';
}

function toItem(communityId: string, messageId: string, message: IncomingMessage): Item {
  const now = new Date().toISOString();
  const type = inferType(message.content);
  const priority = inferPriority(message.content, type);
  const item: Item = {
    id: crypto.randomUUID(),
    communityId,
    messageId,
    type,
    title: titleFrom(message.content),
    summary: message.content.slice(0, 280) || null,
    ownerName: inferOwner(message, type),
    priority,
    dueAt: null,
    confidence: type === 'noise' ? 0.92 : 0.74,
    urgencyScore: 0,
    status: 'pending',
    suggestedReply: type === 'question' ? 'Thanks for asking — a lead will confirm shortly.' : null,
    eventStart: null,
    eventEnd: null,
    eventLocation: null,
    sourceLink: message.permalink ?? null,
    createdAt: now,
    updatedAt: now,
  };
  item.urgencyScore = rankUrgency(item);
  return item;
}

export function mockHealth(): HealthResponse {
  return { ok: true, llm: false, db: false };
}

export function mockIngest(req: IngestRequest): IngestResponse {
  const messageId = crypto.randomUUID();
  const item = toItem(req.communityId, messageId, req.message);

  if (item.type === 'noise') {
    store.items.push(item);
    return { messageId, items: [item], failures: [] };
  }

  if (item.confidence < CONFIDENCE_THRESHOLD) {
    const failure: Failure = {
      id: crypto.randomUUID(),
      communityId: req.communityId,
      messageId,
      reason: 'low_confidence',
      confidence: item.confidence,
      raw: { title: item.title },
      claimedBy: null,
      createdAt: new Date().toISOString(),
      messageContent: req.message.content,
      authorName: req.message.authorName,
    };
    store.failures.push(failure);
    return { messageId, items: [], failures: [failure] };
  }

  store.items.push(item);
  return { messageId, items: [item], failures: [] };
}

export function mockDigest(communityId: string, now = new Date()): Digest {
  return buildDigest(
    store.items.filter((i) => i.communityId === communityId),
    store.failures.filter((f) => f.communityId === communityId),
    now,
  );
}

export function mockStoreSize(): { items: number; failures: number } {
  return { items: store.items.length, failures: store.failures.length };
}
