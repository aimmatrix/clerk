import { toLondonParts } from './ics';
import type { Digest, Failure, Item } from './types';

const DAY_MS = 24 * 60 * 60 * 1000;

const DECISION_WINDOW_MS = 7 * DAY_MS;
const MINUTES_SAVED_PER_APPROVAL = 4;

/** Discord rejects messages over 2000 characters. */
const MAX_POST_LENGTH = 2000;
const ZERO_WIDTH_SPACE = '​';

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/** Statuses of work that has not been completed or thrown away. */
const OPEN_STATUSES = new Set<Item['status']>(['pending', 'approved', 'posted']);
/** Statuses in which a question has no reply posted yet. */
const UNANSWERED_STATUSES = new Set<Item['status']>(['pending', 'approved']);
/** A human has signed these off. */
const APPROVED_STATUSES = new Set<Item['status']>(['approved', 'posted', 'done']);

/** Leading verbs dropped so "Grab pizza" reads as "Ana is on pizza". */
const LEADING_VERBS = new Set([
  'arrange',
  'book',
  'bring',
  'buy',
  'fetch',
  'get',
  'grab',
  'order',
  'organise',
  'organize',
  'provide',
  'sort',
]);

const time = (iso: string | null): number => (iso ? Date.parse(iso) : Number.NaN);

/** Ascending, with missing or unparseable values last. */
function byTimeAsc(a: number, b: number): number {
  if (Number.isNaN(a) || Number.isNaN(b)) return Number.isNaN(a) ? (Number.isNaN(b) ? 0 : 1) : -1;
  return a - b;
}

function byUrgency(a: Item, b: Item): number {
  return (
    b.urgencyScore - a.urgencyScore ||
    byTimeAsc(time(a.dueAt), time(b.dueAt)) ||
    byTimeAsc(time(a.createdAt), time(b.createdAt))
  );
}

/**
 * Groups items into the sections of the weekly digest. Noise and rejected items never appear.
 *
 * - `open`: requests and tasks not yet done, most urgent first.
 * - `overdue`: the open items past their due date, most overdue first.
 * - `unansweredQuestions`: questions with no reply posted, oldest first.
 * - `decisions`: decisions logged in the last seven days, newest first.
 * - `stats`: `captured` counts everything but noise; `approved` counts items a human signed off;
 *   `hoursSaved` is approved x 4 minutes.
 */
export function buildDigest(items: Item[], failures: Failure[], now: Date = new Date()): Digest {
  const nowMs = now.getTime();
  const real = items.filter((i) => i.type !== 'noise');

  const open = real
    .filter((i) => (i.type === 'task' || i.type === 'request') && OPEN_STATUSES.has(i.status))
    .sort(byUrgency);

  const overdue = open
    .filter((i) => time(i.dueAt) < nowMs)
    .sort((a, b) => byTimeAsc(time(a.dueAt), time(b.dueAt)));

  const unansweredQuestions = real
    .filter((i) => i.type === 'question' && UNANSWERED_STATUSES.has(i.status))
    .sort((a, b) => byTimeAsc(time(a.createdAt), time(b.createdAt)));

  const decisions = real
    .filter((i) => {
      if (i.type !== 'decision' || i.status === 'rejected') return false;
      const age = nowMs - time(i.createdAt);
      return age >= 0 && age <= DECISION_WINDOW_MS;
    })
    .sort((a, b) => byTimeAsc(time(b.createdAt), time(a.createdAt)));

  const approved = real.filter((i) => APPROVED_STATUSES.has(i.status)).length;

  return {
    generatedAt: now.toISOString(),
    open,
    overdue,
    unansweredQuestions,
    decisions,
    stats: {
      captured: real.length,
      pending: real.filter((i) => i.status === 'pending').length,
      approved,
      failures: failures.length,
      hoursSaved: Math.round(((approved * MINUTES_SAVED_PER_APPROVAL) / 60) * 100) / 100,
    },
  };
}

/** Whole Europe/London calendar days from `now` to `date`: 0 is today, negative is the past. */
function londonDaysFrom(now: Date, date: Date): number {
  const a = toLondonParts(now);
  const b = toLondonParts(date);
  return Math.round((Date.UTC(b.year, b.month - 1, b.day) - Date.UTC(a.year, a.month - 1, a.day)) / DAY_MS);
}

function shortDate(date: Date): string {
  const p = toLondonParts(date);
  return `${p.weekday} ${p.day} ${MONTHS[p.month - 1]}`;
}

const clock = (date: Date): string => {
  const p = toLondonParts(date);
  return `${String(p.hour).padStart(2, '0')}:${String(p.minute).padStart(2, '0')}`;
};

/** "today", a weekday name within the coming week, otherwise "Thu 29 Oct". */
function formatDue(dueAt: string | null, now: Date): string | null {
  const due = time(dueAt);
  if (Number.isNaN(due)) return null;

  const date = new Date(due);
  const days = londonDaysFrom(now, date);
  if (days === 0) return 'today';
  if (days >= 1 && days <= 6) return toLondonParts(date).weekday;
  return shortDate(date);
}

/** Single line: collapses whitespace and neutralises Discord mentions. */
function cleanInline(value: string): string {
  return neutraliseMentions(value.replace(/\s+/g, ' ').trim());
}

/** Keeps line breaks but still neutralises Discord mentions. */
function cleanBlock(value: string): string {
  return neutraliseMentions(value.replace(/\r\n?/g, '\n').trim());
}

/** Model-written text must never be able to ping a whole server or a specific person or role. */
function neutraliseMentions(value: string): string {
  return value
    .replace(/@(everyone|here)/gi, `@${ZERO_WIDTH_SPACE}$1`)
    .replace(/<@/g, `<${ZERO_WIDTH_SPACE}@`);
}

function truncate(value: string): string {
  return value.length <= MAX_POST_LENGTH ? value : `${value.slice(0, MAX_POST_LENGTH - 1)}…`;
}

/** "Grab pizza" -> "pizza", "Venue for 60" -> "venue for 60". Short titles pass through. */
function taskPhrase(title: string): string {
  const [first, ...rest] = cleanInline(title).split(' ');
  if (!first) return '';
  if (LEADING_VERBS.has(first.toLowerCase()) && rest.length > 0) return rest.join(' ');
  const word = /^[A-Z][a-z]+$/.test(first) ? first.toLowerCase() : first;
  return [word, ...rest].join(' ');
}

function formatEventWhen(item: Item): string | null {
  const start = time(item.eventStart ?? item.dueAt);
  if (Number.isNaN(start)) return null;

  const startDate = new Date(start);
  const end = time(item.eventEnd);
  const when = `${shortDate(startDate)}, ${clock(startDate)}`;
  if (Number.isNaN(end) || end <= start) return when;

  const endDate = new Date(end);
  const sameDay = londonDaysFrom(startDate, endDate) === 0;
  return sameDay ? `${when}–${clock(endDate)}` : `${when} – ${shortDate(endDate)}, ${clock(endDate)}`;
}

export interface PostBackOptions {
  /** Pins the clock that "due Thu" is worked out against. */
  now?: Date;
  /** Appended to event posts so members can add the event to their calendar. */
  icsUrl?: string;
}

/**
 * The text Clerk posts to Discord once a lead has approved an item.
 *
 * - task and request: "✅ Ana is on pizza, due Thu", or "🙋 Needs an owner: ..." when unowned
 * - event: "📅 Event: Meetup — Wed 28 Oct, 18:30–21:00, Shoreditch"
 * - question: "💬 Suggested reply: ..." with the approved reply
 * - decision: "📌 Decision: ..."
 *
 * Noise returns an empty string: it is never posted. Pass `icsUrl` to add a calendar link to
 * events. Text is capped at Discord's 2000 characters and `@everyone`, `@here` and user or role
 * mentions are defused, but callers should still send with `allowed_mentions: { parse: [] }`.
 */
export function formatPostBack(item: Item, options: PostBackOptions = {}): string {
  const now = options.now ?? new Date();
  const title = cleanInline(item.title);

  switch (item.type) {
    case 'task':
    case 'request': {
      const due = formatDue(item.dueAt, now);
      const suffix = due ? `, due ${due}` : '';
      const owner = item.ownerName ? cleanInline(item.ownerName) : '';
      return truncate(
        owner ? `✅ ${owner} is on ${taskPhrase(item.title)}${suffix}` : `🙋 Needs an owner: ${title}${suffix}`,
      );
    }
    case 'event': {
      const when = formatEventWhen(item);
      const location = item.eventLocation ? cleanInline(item.eventLocation) : '';
      const details = [when, location].filter(Boolean).join(', ');
      const line = `📅 Event: ${title}${details ? ` — ${details}` : ''}`;
      const link = options.icsUrl && /^https?:\/\/\S+$/i.test(options.icsUrl.trim()) ? options.icsUrl.trim() : '';
      return truncate(link ? `${line}\n🗓️ Add to calendar: ${link}` : line);
    }
    case 'question':
      return truncate(
        item.suggestedReply
          ? `💬 Suggested reply: ${cleanBlock(item.suggestedReply)}`
          : `💬 Question logged: ${title}`,
      );
    case 'decision':
      return truncate(`📌 Decision: ${title}`);
    default:
      return '';
  }
}
