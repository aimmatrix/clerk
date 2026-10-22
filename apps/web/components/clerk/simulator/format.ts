import type { FailureReason, Item, ItemType, Priority } from '@clerk/core';

/** Tailwind class strings are spelled out in full so the JIT can see them. */
export const TYPE_META: Record<
  ItemType,
  { label: string; text: string; chip: string; border: string; rgb: string }
> = {
  request: { label: 'Request', text: 'text-request', chip: 'bg-request/15 text-request', border: 'border-request/40', rgb: 'var(--request)' },
  task: { label: 'Task', text: 'text-task', chip: 'bg-task/15 text-primary-300', border: 'border-task/40', rgb: 'var(--task)' },
  event: { label: 'Event', text: 'text-event', chip: 'bg-event/15 text-event', border: 'border-event/40', rgb: 'var(--event)' },
  question: { label: 'Question', text: 'text-question', chip: 'bg-question/15 text-question', border: 'border-question/40', rgb: 'var(--question)' },
  decision: { label: 'Decision', text: 'text-decision', chip: 'bg-decision/15 text-decision', border: 'border-decision/40', rgb: 'var(--decision)' },
  noise: { label: 'Noise', text: 'text-muted-foreground', chip: 'bg-white/5 text-muted-foreground', border: 'border-white/10', rgb: 'var(--noise)' },
};

export const PRIORITY_CLASS: Record<Priority, string> = {
  P0: 'bg-urgent/15 text-urgent',
  P1: 'bg-request/15 text-request',
  P2: 'bg-white/10 text-muted-foreground',
  P3: 'bg-white/5 text-muted-foreground/70',
};

export const FAILURE_LABEL: Record<FailureReason, string> = {
  low_confidence: 'Low confidence',
  invalid_json: 'Invalid JSON',
  llm_error: 'Model error',
  ambiguous_owner: 'Ambiguous owner',
  unsupported: 'Unsupported',
};

const TZ = 'Europe/London';

export function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  const first = parts[0]?.[0] ?? '?';
  const last = parts.length > 1 ? (parts[parts.length - 1]?.[0] ?? '') : '';
  return (first + last).toUpperCase();
}

/** Stable per-person colour so avatars read as people, not decoration. */
export function avatarColour(name: string): string {
  let hash = 0;
  for (let i = 0; i < name.length; i += 1) hash = (hash * 31 + name.charCodeAt(i)) >>> 0;
  return `hsl(${hash % 360} 55% 42%)`;
}

export function clock(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '';
  return new Intl.DateTimeFormat('en-GB', { hour: '2-digit', minute: '2-digit', timeZone: TZ }).format(date);
}

function weekday(date: Date): string {
  return new Intl.DateTimeFormat('en-GB', { weekday: 'short', timeZone: TZ }).format(date);
}

function dayKey(date: Date): string {
  return new Intl.DateTimeFormat('en-GB', { dateStyle: 'short', timeZone: TZ }).format(date);
}

/** "due Thu", "due today", "overdue" — relative to `now` (the simulated clock). */
export function dueLabel(iso: string | null, now: Date): string | null {
  if (!iso) return null;
  const due = new Date(iso);
  if (Number.isNaN(due.getTime())) return null;
  if (dayKey(due) === dayKey(now)) return due.getTime() < now.getTime() ? 'overdue' : 'due today';
  if (due.getTime() < now.getTime()) return 'overdue';
  return `due ${weekday(due)}`;
}

/** Local stand-in for C11's formatPostBack, used only for the simulated "Posted" column. */
export function postBackText(item: Item, now: Date): string {
  const due = dueLabel(item.dueAt, now);
  switch (item.type) {
    case 'task':
    case 'request':
      return item.ownerName
        ? `✅ ${item.ownerName}: ${item.title}${due ? `, ${due}` : ''}`
        : `🙋 Needs an owner: ${item.title}`;
    case 'event':
      return `📅 Event: ${item.title}`;
    case 'question':
      return `💬 Suggested reply: ${item.suggestedReply ?? item.title}`;
    case 'decision':
      return `📌 Decision: ${item.title}`;
    default:
      return item.title;
  }
}
