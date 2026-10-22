import type { Failure, FailureReason, Item, ItemStatus, ItemType, Priority } from '@clerk/core';

/**
 * snake_case (Postgres / realtime payloads) <-> camelCase (shared contract types) mappers.
 * Pure and isomorphic: safe to import from API routes (X3/X4), the bot and the browser.
 */

export interface ItemRow {
  id: string;
  community_id: string;
  message_id: string;
  type: ItemType;
  title: string;
  summary: string | null;
  owner_name: string | null;
  priority: Priority;
  due_at: string | null;
  confidence: number | string;
  urgency_score: number | string;
  status: ItemStatus;
  suggested_reply: string | null;
  event_start: string | null;
  event_end: string | null;
  event_location: string | null;
  source_link: string | null;
  created_at: string | null;
  updated_at: string | null;
}

export interface FailureRow {
  id: string;
  community_id: string;
  message_id: string | null;
  reason: FailureReason;
  confidence: number | string | null;
  raw: unknown;
  claimed_by: string | null;
  created_at: string | null;
  /** Present when the query joined `messages(content, author_name)`; realtime payloads never carry it. */
  messages?: { content: string | null; author_name: string | null } | null;
}

export interface MessageRow {
  id: string;
  community_id: string;
  source: 'discord' | 'simulator';
  external_id: string;
  channel_id: string | null;
  thread_id: string | null;
  reply_to_external_id: string | null;
  author_name: string;
  author_external_id: string | null;
  content: string;
  permalink: string | null;
  sent_at: string | null;
  processed: boolean | null;
}

/** A persisted chat message (distinct from the ingest-time `IncomingMessage`). */
export interface StoredMessage {
  id: string;
  communityId: string;
  source: 'discord' | 'simulator';
  externalId: string;
  channelId: string | null;
  threadId: string | null;
  replyToExternalId: string | null;
  authorName: string;
  authorExternalId: string | null;
  content: string;
  permalink: string | null;
  sentAt: string;
  processed: boolean;
}

/** Normalises Postgres timestamptz (`…+00:00`) to ISO-8601 `Z` so string comparison and Date parsing agree. */
function iso(value: string | null | undefined): string | null {
  if (value == null) return null;
  const time = Date.parse(value);
  return Number.isNaN(time) ? value : new Date(time).toISOString();
}

function isoOrNow(value: string | null | undefined): string {
  return iso(value) ?? new Date().toISOString();
}

function num(value: number | string | null | undefined, fallback = 0): number {
  if (value == null) return fallback;
  const n = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(n) ? n : fallback;
}

export function rowToItem(row: ItemRow): Item {
  return {
    id: row.id,
    communityId: row.community_id,
    messageId: row.message_id,
    type: row.type,
    title: row.title,
    summary: row.summary ?? null,
    ownerName: row.owner_name ?? null,
    priority: row.priority ?? 'P2',
    dueAt: iso(row.due_at),
    confidence: num(row.confidence),
    urgencyScore: Math.round(num(row.urgency_score)),
    status: row.status ?? 'pending',
    suggestedReply: row.suggested_reply ?? null,
    eventStart: iso(row.event_start),
    eventEnd: iso(row.event_end),
    eventLocation: row.event_location ?? null,
    sourceLink: row.source_link ?? null,
    createdAt: isoOrNow(row.created_at),
    updatedAt: isoOrNow(row.updated_at ?? row.created_at),
  };
}

const ITEM_COLUMNS = {
  communityId: 'community_id',
  messageId: 'message_id',
  type: 'type',
  title: 'title',
  summary: 'summary',
  ownerName: 'owner_name',
  priority: 'priority',
  dueAt: 'due_at',
  confidence: 'confidence',
  urgencyScore: 'urgency_score',
  status: 'status',
  suggestedReply: 'suggested_reply',
  eventStart: 'event_start',
  eventEnd: 'event_end',
  eventLocation: 'event_location',
  sourceLink: 'source_link',
  createdAt: 'created_at',
  updatedAt: 'updated_at',
} as const satisfies Record<keyof Omit<Item, 'id'>, keyof ItemRow>;

/**
 * Partial-aware: only keys present (not `undefined`) are emitted, so it works for both inserts and
 * PATCH-style updates. `null` is preserved (it clears a column).
 */
export function itemToRow(item: Partial<Item>): Partial<ItemRow> {
  const row: Record<string, unknown> = {};
  if (item.id !== undefined) row.id = item.id;
  for (const key of Object.keys(ITEM_COLUMNS) as (keyof typeof ITEM_COLUMNS)[]) {
    const value = item[key];
    if (value !== undefined) row[ITEM_COLUMNS[key]] = value;
  }
  return row as Partial<ItemRow>;
}

export function rowToFailure(row: FailureRow): Failure {
  const failure: Failure = {
    id: row.id,
    communityId: row.community_id,
    messageId: row.message_id ?? null,
    reason: row.reason,
    confidence: row.confidence == null ? null : num(row.confidence),
    raw: row.raw ?? null,
    claimedBy: row.claimed_by ?? null,
    createdAt: isoOrNow(row.created_at),
  };
  if (row.messages?.content != null) failure.messageContent = row.messages.content;
  if (row.messages?.author_name != null) failure.authorName = row.messages.author_name;
  return failure;
}

export function rowToMessage(row: MessageRow): StoredMessage {
  return {
    id: row.id,
    communityId: row.community_id,
    source: row.source,
    externalId: row.external_id,
    channelId: row.channel_id ?? null,
    threadId: row.thread_id ?? null,
    replyToExternalId: row.reply_to_external_id ?? null,
    authorName: row.author_name,
    authorExternalId: row.author_external_id ?? null,
    content: row.content,
    permalink: row.permalink ?? null,
    sentAt: isoOrNow(row.sent_at),
    processed: row.processed ?? false,
  };
}
