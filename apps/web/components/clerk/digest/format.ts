import type { Item } from '@clerk/core';

const TZ = 'Europe/London';
const UNASSIGNED = 'Unassigned';

export const UNASSIGNED_LABEL = UNASSIGNED;

const dayName = new Intl.DateTimeFormat('en-GB', { weekday: 'short', timeZone: TZ });
const dayMonth = new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short', timeZone: TZ });
const clock = new Intl.DateTimeFormat('en-GB', { hour: '2-digit', minute: '2-digit', hour12: false, timeZone: TZ });

const DAY_MS = 86_400_000;

/** Calendar-day difference in Europe/London (due minus now). */
function dayDiff(due: Date, now: Date): number {
  const key = (d: Date) => {
    const [dd, mm, yyyy] = new Intl.DateTimeFormat('en-GB', { timeZone: TZ }).format(d).split('/');
    return Date.UTC(Number(yyyy), Number(mm) - 1, Number(dd));
  };
  return Math.round((key(due) - key(now)) / DAY_MS);
}

/** "due Thu", "due today", "due tomorrow", "2 days overdue". */
export function formatDue(dueAt: string | null, now: Date): { label: string; overdue: boolean } | null {
  if (!dueAt) return null;
  const due = new Date(dueAt);
  if (Number.isNaN(due.getTime())) return null;

  const diff = dayDiff(due, now);
  if (due.getTime() < now.getTime()) {
    if (diff === 0) return { label: 'overdue today', overdue: true };
    const days = Math.abs(diff);
    return { label: `${days} day${days === 1 ? '' : 's'} overdue`, overdue: true };
  }
  if (diff === 0) return { label: 'due today', overdue: false };
  if (diff === 1) return { label: 'due tomorrow', overdue: false };
  if (diff < 7) return { label: `due ${dayName.format(due)}`, overdue: false };
  return { label: `due ${dayMonth.format(due)}`, overdue: false };
}

/** "Thu 23 Oct, 14:05" */
export function formatGenerated(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return `${dayName.format(d)} ${dayMonth.format(d)}, ${clock.format(d)}`;
}

export function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

export function hoursLabel(hours: number): string {
  if (hours <= 0) return '0';
  return hours < 10 ? hours.toFixed(1) : String(Math.round(hours));
}

export interface OwnerGroup {
  owner: string;
  items: Item[];
}

/** Group by owner (most items first, unassigned last); items by urgency desc. */
export function groupByOwner(items: Item[]): OwnerGroup[] {
  const map = new Map<string, Item[]>();
  for (const item of items) {
    const key = item.ownerName?.trim() || UNASSIGNED;
    const list = map.get(key);
    if (list) list.push(item);
    else map.set(key, [item]);
  }
  return [...map.entries()]
    .map(([owner, list]) => ({ owner, items: [...list].sort((a, b) => b.urgencyScore - a.urgencyScore) }))
    .sort((a, b) => {
      if (a.owner === UNASSIGNED) return 1;
      if (b.owner === UNASSIGNED) return -1;
      return b.items.length - a.items.length || a.owner.localeCompare(b.owner, 'en-GB');
    });
}

export function sortByUrgency(items: Item[]): Item[] {
  return [...items].sort((a, b) => b.urgencyScore - a.urgencyScore);
}
