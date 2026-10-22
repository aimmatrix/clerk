const LONDON = 'Europe/London';

export function cx(...parts: Array<string | false | null | undefined>): string {
  return parts.filter(Boolean).join(' ');
}

export function initials(name: string | null | undefined): string {
  if (!name) return '?';
  const words = name.trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return '?';
  if (words.length === 1) return words[0].slice(0, 2).toUpperCase();
  return (words[0][0] + words[words.length - 1][0]).toUpperCase();
}

/** Deterministic hue so the same person always gets the same avatar colour. */
export function avatarHue(name: string): number {
  let hash = 0;
  for (let i = 0; i < name.length; i += 1) hash = (hash * 31 + name.charCodeAt(i)) % 360;
  return hash;
}

function londonDayKey(date: Date): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: LONDON,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(date);
}

function dayDiff(from: Date, to: Date): number {
  const a = Date.parse(`${londonDayKey(from)}T00:00:00Z`);
  const b = Date.parse(`${londonDayKey(to)}T00:00:00Z`);
  return Math.round((b - a) / 86_400_000);
}

export interface DueLabel {
  text: string;
  overdue: boolean;
  soon: boolean;
}

/** "due Thu", "due today", "due in 3h", "overdue 2d". Returns null when there is no deadline. */
export function formatDue(dueAt: string | null, now: Date = new Date()): DueLabel | null {
  if (!dueAt) return null;
  const due = new Date(dueAt);
  if (Number.isNaN(due.getTime())) return null;

  const ms = due.getTime() - now.getTime();
  if (ms < 0) {
    const days = Math.max(0, -dayDiff(now, due));
    const hours = Math.floor(-ms / 3_600_000);
    const text = days >= 1 ? `overdue ${days}d` : hours >= 1 ? `overdue ${hours}h` : 'overdue';
    return { text, overdue: true, soon: true };
  }

  const days = dayDiff(now, due);
  if (days === 0) {
    const hours = Math.floor(ms / 3_600_000);
    return { text: hours < 1 ? 'due within the hour' : hours < 6 ? `due in ${hours}h` : 'due today', overdue: false, soon: true };
  }
  if (days === 1) return { text: 'due tomorrow', overdue: false, soon: true };
  if (days < 7) {
    const weekday = new Intl.DateTimeFormat('en-GB', { timeZone: LONDON, weekday: 'short' }).format(due);
    return { text: `due ${weekday}`, overdue: false, soon: days <= 3 };
  }
  const date = new Intl.DateTimeFormat('en-GB', { timeZone: LONDON, day: 'numeric', month: 'short' }).format(due);
  return { text: `due ${date}`, overdue: false, soon: false };
}
