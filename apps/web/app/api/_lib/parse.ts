import {
  ITEM_TYPES,
  PRIORITIES,
  REVIEW_ACTIONS,
  type IncomingMessage,
  type IngestRequest,
  type Item,
  type ItemType,
  type Priority,
  type ReviewAction,
  type ReviewRequest,
} from '../_mock-core';

const ITEM_TYPE_SET = new Set<string>(ITEM_TYPES);
const PRIORITY_SET = new Set<string>(PRIORITIES);
const ACTION_SET = new Set<string>(REVIEW_ACTIONS);

function asString(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim() ? value.trim() : undefined;
}

function asNullableString(value: unknown): string | null | undefined {
  if (value === null) return null;
  if (typeof value === 'string') return value.trim() || null;
  return undefined;
}

export function parseIncomingMessage(raw: unknown): IncomingMessage | null {
  if (!raw || typeof raw !== 'object') return null;
  const row = raw as Record<string, unknown>;
  const externalId = asString(row.externalId) ?? asString(row.external_id);
  const authorName = asString(row.authorName) ?? asString(row.author_name);
  const content = typeof row.content === 'string' ? row.content : undefined;
  if (!externalId || !authorName || content === undefined) return null;
  const source = row.source === 'simulator' || row.source === 'discord' ? row.source : 'discord';
  const sentAt = asString(row.sentAt) ?? asString(row.sent_at) ?? new Date().toISOString();
  return {
    externalId,
    channelId: asString(row.channelId) ?? asString(row.channel_id),
    threadId: asString(row.threadId) ?? asString(row.thread_id),
    replyToExternalId: asString(row.replyToExternalId) ?? asString(row.reply_to_external_id),
    authorName,
    authorExternalId: asString(row.authorExternalId) ?? asString(row.author_external_id),
    content,
    permalink: asString(row.permalink),
    sentAt,
    source,
  };
}

export function parseIngestRequest(raw: unknown): IngestRequest | null {
  if (!raw || typeof raw !== 'object') return null;
  const row = raw as Record<string, unknown>;
  const communityId = asString(row.communityId) ?? asString(row.community_id);
  const message = parseIncomingMessage(row.message);
  if (!communityId || !message) return null;
  const context = Array.isArray(row.context)
    ? row.context.map(parseIncomingMessage).filter((m): m is IncomingMessage => m !== null)
    : [];
  return { communityId, message, context };
}

export function parseReviewRequest(raw: unknown): ReviewRequest | null {
  if (!raw || typeof raw !== 'object') return null;
  const row = raw as Record<string, unknown>;
  const action = asString(row.action);
  const actor = asString(row.actor);
  if (!action || !ACTION_SET.has(action) || !actor) return null;

  let patch: ReviewRequest['patch'];
  if (row.patch && typeof row.patch === 'object') {
    const p = row.patch as Record<string, unknown>;
    const next: NonNullable<ReviewRequest['patch']> = {};
    const title = asString(p.title);
    if (title) next.title = title;
    if ('ownerName' in p) next.ownerName = asNullableString(p.ownerName) ?? null;
    const priority = asString(p.priority);
    if (priority && PRIORITY_SET.has(priority)) next.priority = priority as Priority;
    if ('dueAt' in p) next.dueAt = asNullableString(p.dueAt) ?? null;
    const type = asString(p.type);
    if (type && ITEM_TYPE_SET.has(type)) next.type = type as ItemType;
    if ('suggestedReply' in p) next.suggestedReply = asNullableString(p.suggestedReply) ?? null;
    patch = next;
  }

  return { action: action as ReviewAction, actor, patch };
}

export function isItemType(value: string): value is ItemType {
  return ITEM_TYPE_SET.has(value);
}

export function isItemStatus(value: string): value is Item['status'] {
  return value === 'pending' || value === 'approved' || value === 'posted' || value === 'done' || value === 'rejected';
}

export function isPriority(value: string): value is Priority {
  return PRIORITY_SET.has(value);
}
