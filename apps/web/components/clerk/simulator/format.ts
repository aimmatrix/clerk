import type { FailureReason, Item, ItemType, Priority } from '@clerk/core';

/** Tailwind class strings are spelled out in full so the JIT can see them. */
export const TYPE_META: Record<
  ItemType,
  { label: string; text: string; chip: string; border: string; rgb: string }
> = {
  request: { label: 'Request', text: 'text-muted-foreground', chip: 'text-muted-foreground', border: 'border-border', rgb: 'var(--request)' },
  task: { label: 'Task', text: 'text-muted-foreground', chip: 'text-muted-foreground', border: 'border-border', rgb: 'var(--task)' },
  event: { label: 'Event', text: 'text-muted-foreground', chip: 'text-muted-foreground', border: 'border-border', rgb: 'var(--event)' },
  question: { label: 'Question', text: 'text-muted-foreground', chip: 'text-muted-foreground', border: 'border-border', rgb: 'var(--question)' },
  decision: { label: 'Decision', text: 'text-muted-foreground', chip: 'text-muted-foreground', border: 'border-border', rgb: 'var(--decision)' },
  noise: { label: 'Noise', text: 'text-subtle', chip: 'text-subtle', border: 'border-border', rgb: 'var(--noise)' },
};

export const PRIORITY_CLASS: Record<Priority, string> = {
  P0: 'font-semibold text-urgent',
  P1: 'font-medium text-foreground',
  P2: 'text-muted-foreground',
  P3: 'text-subtle',
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
