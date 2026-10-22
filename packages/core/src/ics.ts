import type { Item } from './types';

const HOUR_MS = 60 * 60 * 1000;

const LONDON_TZID = 'Europe/London';
const PRODID = '-//Clerk//Community inbox//EN';
const DEFAULT_DURATION_MS = HOUR_MS;

/** RFC 5545 section 3.1: content lines are folded at 75 octets, excluding the CRLF. */
const MAX_LINE_OCTETS = 75;
const CRLF = '\r\n';

/** Europe/London rules as a repeating pair, so any year resolves without a tz database. */
const VTIMEZONE_LONDON = [
  'BEGIN:VTIMEZONE',
  `TZID:${LONDON_TZID}`,
  'BEGIN:DAYLIGHT',
  'TZOFFSETFROM:+0000',
  'TZOFFSETTO:+0100',
  'TZNAME:BST',
  'DTSTART:19700329T010000',
  'RRULE:FREQ=YEARLY;BYMONTH=3;BYDAY=-1SU',
  'END:DAYLIGHT',
  'BEGIN:STANDARD',
  'TZOFFSETFROM:+0100',
  'TZOFFSETTO:+0000',
  'TZNAME:GMT',
  'DTSTART:19701025T020000',
  'RRULE:FREQ=YEARLY;BYMONTH=10;BYDAY=-1SU',
  'END:STANDARD',
  'END:VTIMEZONE',
];

const londonFormat = new Intl.DateTimeFormat('en-GB', {
  timeZone: LONDON_TZID,
  weekday: 'short',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  second: '2-digit',
  hourCycle: 'h23',
});

export interface LondonParts {
  weekday: string;
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  second: number;
}

/** Wall-clock fields of an instant in Europe/London, accounting for BST. */
export function toLondonParts(date: Date): LondonParts {
  const fields: Record<string, string> = {};
  for (const part of londonFormat.formatToParts(date)) fields[part.type] = part.value;

  return {
    weekday: fields.weekday,
    year: Number(fields.year),
    month: Number(fields.month),
    day: Number(fields.day),
    hour: Number(fields.hour),
    minute: Number(fields.minute),
    second: Number(fields.second),
  };
}

const pad = (n: number, width = 2) => String(n).padStart(width, '0');

function formatLocal(date: Date): string {
  const p = toLondonParts(date);
  return `${pad(p.year, 4)}${pad(p.month)}${pad(p.day)}T${pad(p.hour)}${pad(p.minute)}${pad(p.second)}`;
}

function formatUtc(date: Date): string {
  return `${date.toISOString().slice(0, 19).replace(/[-:]/g, '')}Z`;
}

/** Drops control characters that would break a content line. Newlines are handled separately. */
const CONTROL_CHARS = /[\u0000-\u0009\u000b\u000c\u000e-\u001f\u007f]/g;

/** TEXT value escaping from RFC 5545 section 3.3.11. */
function escapeText(value: string): string {
  return value
    .replace(CONTROL_CHARS, '')
    .replace(/\\/g, '\\\\')
    .replace(/;/g, '\\;')
    .replace(/,/g, '\\,')
    .replace(/\r\n|\r|\n/g, '\\n');
}

/** UTF-8 length of one code point. */
function utf8Size(codePoint: number): number {
  if (codePoint < 0x80) return 1;
  if (codePoint < 0x800) return 2;
  return codePoint < 0x10000 ? 3 : 4;
}

/** Folds a content line at 75 octets without splitting a multi-byte character. */
function foldLine(line: string): string {
  const out: string[] = [];
  let current = '';
  let octets = 0;

  for (const char of line) {
    const size = utf8Size(char.codePointAt(0) ?? 0);
    // A continuation line starts with a space, which counts towards its 75 octets.
    const limit = out.length === 0 ? MAX_LINE_OCTETS : MAX_LINE_OCTETS - 1;
    if (octets + size > limit) {
      out.push(current);
      current = '';
      octets = 0;
    }
    current += char;
    octets += size;
  }
  out.push(current);

  return out.join(`${CRLF} `);
}

function parseInstant(value: string | null | undefined): Date | null {
  if (!value) return null;
  const time = Date.parse(value);
  return Number.isNaN(time) ? null : new Date(time);
}

function startOf(item: Item): Date | null {
  return parseInstant(item.eventStart) ?? parseInstant(item.dueAt);
}

/** Only http(s) links are allowed through into the URL property. */
function safeUrl(value: string | null): string | null {
  if (!value) return null;
  const trimmed = value.trim();
  return /^https?:\/\/\S+$/i.test(trimmed) ? trimmed : null;
}

/** True when the item has a usable start time: `eventStart`, falling back to `dueAt`. */
export function canExportIcs(item: Item): boolean {
  return startOf(item) !== null;
}

/**
 * Renders a single-event iCalendar (RFC 5545) file for an item, with Europe/London local times.
 *
 * Starts at `eventStart` (falling back to `dueAt`) and ends at `eventEnd`, or an hour later when
 * the end is missing or not after the start. DTSTAMP comes from `updatedAt`, so the same item
 * always produces the same file. Throws if the item has no usable start time; check with
 * `canExportIcs` first.
 */
export function toIcs(item: Item): string {
  const start = startOf(item);
  if (!start) throw new Error(`Item ${item.id} has no start time to export`);

  const parsedEnd = parseInstant(item.eventEnd);
  const end =
    parsedEnd && parsedEnd.getTime() > start.getTime()
      ? parsedEnd
      : new Date(start.getTime() + DEFAULT_DURATION_MS);
  const stamp = parseInstant(item.updatedAt) ?? new Date();

  const description = [
    item.summary,
    item.ownerName ? `Owner: ${item.ownerName}` : null,
    item.sourceLink ? `Source: ${item.sourceLink}` : null,
  ]
    .filter(Boolean)
    .join('\n');

  const url = safeUrl(item.sourceLink);
  const event = [
    'BEGIN:VEVENT',
    `UID:${item.id.replace(CONTROL_CHARS, '')}@clerk`,
    `DTSTAMP:${formatUtc(stamp)}`,
    `DTSTART;TZID=${LONDON_TZID}:${formatLocal(start)}`,
    `DTEND;TZID=${LONDON_TZID}:${formatLocal(end)}`,
    `SUMMARY:${escapeText(item.title)}`,
    item.eventLocation ? `LOCATION:${escapeText(item.eventLocation)}` : null,
    description ? `DESCRIPTION:${escapeText(description)}` : null,
    url ? `URL:${url}` : null,
    'STATUS:CONFIRMED',
    'END:VEVENT',
  ].filter((line): line is string => line !== null);

  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    `PRODID:${PRODID}`,
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    ...VTIMEZONE_LONDON,
    ...event,
    'END:VCALENDAR',
  ];

  return lines.map(foldLine).join(CRLF) + CRLF;
}
