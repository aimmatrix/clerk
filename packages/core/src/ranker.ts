import type { ExtractedItem, Item, Priority } from './types';

const HOUR_MS = 60 * 60 * 1000;

const BASE_BY_PRIORITY: Record<Priority, number> = {
  P0: 70,
  P1: 50,
  P2: 30,
  P3: 10,
};

const DUE_OVERDUE_BONUS = 30;
const DUE_24H_BONUS = 25;
const DUE_72H_BONUS = 15;

const REQUEST_BONUS = 5;
const STALE_QUESTION_BONUS = 10;
const STALE_QUESTION_AFTER_MS = 12 * HOUR_MS;

const KEYWORD_BONUS = 10;
const URGENT_KEYWORDS = /\b(?:urgent|asap|tonight)\b/i;

const MAX_SCORE = 100;

/** Statuses in which a question still has no answer posted back to the community. */
const UNANSWERED_STATUSES = new Set<Item['status']>(['pending', 'approved']);

interface NormalisedItem {
  type: ExtractedItem['type'];
  priority: Priority;
  dueAt: string | null;
  text: string;
  /** Only known for stored items; extractions have no age and no status. */
  ageMs: number | null;
  unanswered: boolean;
}

function isStoredItem(item: ExtractedItem | Item): item is Item {
  return 'urgencyScore' in item;
}

function normalise(item: ExtractedItem | Item, now: Date): NormalisedItem {
  if (isStoredItem(item)) {
    const created = Date.parse(item.createdAt);
    return {
      type: item.type,
      priority: item.priority,
      dueAt: item.dueAt,
      text: `${item.title} ${item.summary ?? ''}`,
      ageMs: Number.isNaN(created) ? null : now.getTime() - created,
      unanswered: UNANSWERED_STATUSES.has(item.status),
    };
  }
  return {
    type: item.type,
    priority: item.priority,
    dueAt: item.due_at,
    text: `${item.title} ${item.summary}`,
    ageMs: null,
    unanswered: true,
  };
}

function dueBonus(dueAt: string | null, now: Date): number {
  if (!dueAt) return 0;
  const due = Date.parse(dueAt);
  if (Number.isNaN(due)) return 0;

  const remaining = due - now.getTime();
  if (remaining < 0) return DUE_OVERDUE_BONUS;
  if (remaining <= 24 * HOUR_MS) return DUE_24H_BONUS;
  if (remaining <= 72 * HOUR_MS) return DUE_72H_BONUS;
  return 0;
}

function typeBonus(item: NormalisedItem): number {
  if (item.type === 'request') return REQUEST_BONUS;
  if (
    item.type === 'question' &&
    item.unanswered &&
    item.ageMs !== null &&
    item.ageMs > STALE_QUESTION_AFTER_MS
  ) {
    return STALE_QUESTION_BONUS;
  }
  return 0;
}

/**
 * Urgency score from 0 to 100 used to sort the board and review queue.
 *
 * base(priority) + due proximity + type weight + urgent keywords, capped at 100.
 * Pure and deterministic: pass `now` to pin the clock. Noise always scores 0.
 */
export function rankUrgency(item: ExtractedItem | Item, now: Date = new Date()): number {
  const n = normalise(item, now);
  if (n.type === 'noise') return 0;

  const keywords = URGENT_KEYWORDS.test(n.text) ? KEYWORD_BONUS : 0;
  const score = BASE_BY_PRIORITY[n.priority] + dueBonus(n.dueAt, now) + typeBonus(n) + keywords;

  return Math.min(MAX_SCORE, score);
}
