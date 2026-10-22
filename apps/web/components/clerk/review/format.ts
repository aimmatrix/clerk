import type { ItemType, Priority } from "@clerk/core";

export const TYPE_META: Record<ItemType, { label: string; colour: string }> = {
  request: { label: "Request", colour: "#52525B" },
  task: { label: "Task", colour: "#52525B" },
  event: { label: "Event", colour: "#52525B" },
  question: { label: "Question", colour: "#52525B" },
  decision: { label: "Decision", colour: "#52525B" },
  noise: { label: "Noise", colour: "#A1A1AA" },
};

export const PRIORITY_META: Record<Priority, { label: string; colour: string }> = {
  P0: { label: "P0 · Urgent", colour: "#C2410C" },
  P1: { label: "P1 · High", colour: "#18181B" },
  P2: { label: "P2 · Normal", colour: "#52525B" },
  P3: { label: "P3 · Low", colour: "#71717A" },
};

export const TYPE_OPTIONS: ItemType[] = ["request", "task", "event", "question", "decision", "noise"];
export const PRIORITY_OPTIONS: Priority[] = ["P0", "P1", "P2", "P3"];

const TZ = "Europe/London";

function londonParts(date: Date) {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(date);
  const get = (type: string) => Number(parts.find((p) => p.type === type)?.value ?? 0);
  return { year: get("year"), month: get("month"), day: get("day"), hour: get("hour"), minute: get("minute") };
}

function londonDayNumber(date: Date): number {
  const p = londonParts(date);
  return Date.UTC(p.year, p.month - 1, p.day) / 86_400_000;
}

function parse(iso: string | null | undefined): Date | null {
  if (!iso) return null;
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? null : d;
}

export function isOverdue(iso: string | null, now: Date = new Date()): boolean {
  const due = parse(iso);
  return due !== null && due.getTime() < now.getTime();
}

/** "due Thu", "due tomorrow", "overdue" … always Europe/London. */
export function formatDueShort(iso: string | null, now: Date = new Date()): string {
  const due = parse(iso);
  if (!due) return "no deadline";
  if (due.getTime() < now.getTime()) return "overdue";
  const diff = londonDayNumber(due) - londonDayNumber(now);
  if (diff <= 0) return "due today";
  if (diff === 1) return "due tomorrow";
  if (diff <= 6) {
    return `due ${new Intl.DateTimeFormat("en-GB", { timeZone: TZ, weekday: "short" }).format(due)}`;
  }
  return `due ${new Intl.DateTimeFormat("en-GB", { timeZone: TZ, day: "numeric", month: "short" }).format(due)}`;
}

/** "Thu 24 Oct, 18:00" in Europe/London. */
export function formatDateTime(iso: string | null): string {
  const d = parse(iso);
  if (!d) return "—";
  const fmt = (opts: Intl.DateTimeFormatOptions) => new Intl.DateTimeFormat("en-GB", { timeZone: TZ, ...opts }).format(d);
  const time = fmt({ hour: "2-digit", minute: "2-digit", hourCycle: "h23" });
  return `${fmt({ weekday: "short" })} ${fmt({ day: "numeric" })} ${fmt({ month: "short" })}, ${time}`;
}

export function formatAge(iso: string, now: Date = new Date()): string {
  const d = parse(iso);
  if (!d) return "";
  const mins = Math.max(0, Math.round((now.getTime() - d.getTime()) / 60_000));
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins} min ago`;
  const hours = Math.round(mins / 60);
  if (hours < 24) return `${hours} h ago`;
  return `${Math.round(hours / 24)} d ago`;
}

export function initials(name: string | null): string {
  if (!name) return "?";
  const words = name.trim().split(/\s+/).filter(Boolean);
  const first = words[0]?.[0] ?? "?";
  const last = words.length > 1 ? (words[words.length - 1]?.[0] ?? "") : "";
  return (first + last).toUpperCase();
}

/** ISO instant → value for <input type="datetime-local"> expressed in London wall-clock time. */
export function toLondonInput(iso: string | null): string {
  const d = parse(iso);
  if (!d) return "";
  const p = londonParts(d);
  const two = (n: number) => String(n).padStart(2, "0");
  return `${p.year}-${two(p.month)}-${two(p.day)}T${two(p.hour)}:${two(p.minute)}`;
}

/** London wall-clock "YYYY-MM-DDTHH:mm" → ISO instant (handles GMT/BST). Empty string → null. */
export function fromLondonInput(value: string): string | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/.exec(value);
  if (!m) return null;
  const n = (i: number) => Number(m[i]);
  const wanted = Date.UTC(n(1), n(2) - 1, n(3), n(4), n(5));
  let guess = wanted;
  for (let i = 0; i < 2; i++) {
    const p = londonParts(new Date(guess));
    guess += wanted - Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute);
  }
  return new Date(guess).toISOString();
}
