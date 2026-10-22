import { describe, expect, it } from 'vitest';
import { buildDigest, formatPostBack } from '../src/digest';
import { canExportIcs, toIcs } from '../src/ics';
import type { Failure, Item } from '../src/types';

// A Monday afternoon in BST.
const NOW = new Date('2026-10-19T09:00:00Z');
const HOUR_MS = 60 * 60 * 1000;
const DAY_MS = 24 * HOUR_MS;

const fromNow = (ms: number) => new Date(NOW.getTime() + ms).toISOString();

let counter = 0;

function item(overrides: Partial<Item> = {}): Item {
  counter += 1;
  return {
    id: `item-${counter}`,
    communityId: 'community-1',
    messageId: `message-${counter}`,
    type: 'task',
    title: 'Grab pizza',
    summary: 'Ana volunteered to get pizza',
    ownerName: 'Ana',
    priority: 'P2',
    dueAt: null,
    confidence: 0.9,
    urgencyScore: 30,
    status: 'pending',
    suggestedReply: null,
    eventStart: null,
    eventEnd: null,
    eventLocation: null,
    sourceLink: null,
    createdAt: fromNow(-DAY_MS),
    updatedAt: fromNow(-DAY_MS),
    ...overrides,
  };
}

function failure(overrides: Partial<Failure> = {}): Failure {
  counter += 1;
  return {
    id: `failure-${counter}`,
    communityId: 'community-1',
    messageId: `message-${counter}`,
    reason: 'low_confidence',
    confidence: 0.4,
    raw: null,
    claimedBy: null,
    createdAt: fromNow(-HOUR_MS),
    ...overrides,
  };
}

const ids = (items: Item[]) => items.map((i) => i.id);

describe('buildDigest: sections', () => {
  it('lists open requests and tasks, most urgent first', () => {
    const low = item({ id: 'low', urgencyScore: 20 });
    const high = item({ id: 'high', type: 'request', urgencyScore: 90 });
    const done = item({ id: 'done', status: 'done' });
    const rejected = item({ id: 'rejected', status: 'rejected' });
    const posted = item({ id: 'posted', status: 'posted', urgencyScore: 50 });

    const digest = buildDigest([low, high, done, rejected, posted], [], NOW);

    expect(ids(digest.open)).toEqual(['high', 'posted', 'low']);
  });

  it('breaks urgency ties by the earlier due date', () => {
    const later = item({ id: 'later', urgencyScore: 50, dueAt: fromNow(2 * DAY_MS) });
    const sooner = item({ id: 'sooner', urgencyScore: 50, dueAt: fromNow(DAY_MS) });
    const undated = item({ id: 'undated', urgencyScore: 50 });

    expect(ids(buildDigest([undated, later, sooner], [], NOW).open)).toEqual(['sooner', 'later', 'undated']);
  });

  it('flags open items past their due date as overdue, most overdue first', () => {
    const slightly = item({ id: 'slightly', dueAt: fromNow(-HOUR_MS) });
    const badly = item({ id: 'badly', dueAt: fromNow(-3 * DAY_MS) });
    const upcoming = item({ id: 'upcoming', dueAt: fromNow(HOUR_MS) });
    const undated = item({ id: 'undated' });
    const finished = item({ id: 'finished', dueAt: fromNow(-DAY_MS), status: 'done' });

    const digest = buildDigest([slightly, badly, upcoming, undated, finished], [], NOW);

    expect(ids(digest.overdue)).toEqual(['badly', 'slightly']);
  });

  it('lists unanswered questions oldest first and drops answered ones', () => {
    const recent = item({ id: 'recent', type: 'question', createdAt: fromNow(-HOUR_MS) });
    const stale = item({ id: 'stale', type: 'question', createdAt: fromNow(-2 * DAY_MS), status: 'approved' });
    const answered = item({ id: 'answered', type: 'question', status: 'posted' });
    const dismissed = item({ id: 'dismissed', type: 'question', status: 'rejected' });

    const digest = buildDigest([recent, stale, answered, dismissed], [], NOW);

    expect(ids(digest.unansweredQuestions)).toEqual(['stale', 'recent']);
  });

  it('keeps decisions from the last seven days, newest first, and drops rejected ones', () => {
    const today = item({ id: 'today', type: 'decision', createdAt: fromNow(-HOUR_MS) });
    const fiveDays = item({ id: 'five-days', type: 'decision', createdAt: fromNow(-5 * DAY_MS) });
    const eightDays = item({ id: 'eight-days', type: 'decision', createdAt: fromNow(-8 * DAY_MS) });
    const rejected = item({ id: 'rejected', type: 'decision', status: 'rejected' });

    const digest = buildDigest([fiveDays, eightDays, rejected, today], [], NOW);

    expect(ids(digest.decisions)).toEqual(['today', 'five-days']);
  });

  it('keeps noise out of every section and every count', () => {
    const noise = item({ id: 'noise', type: 'noise', status: 'approved', dueAt: fromNow(-DAY_MS) });

    const digest = buildDigest([noise], [], NOW);

    expect(digest.open).toEqual([]);
    expect(digest.overdue).toEqual([]);
    expect(digest.stats.captured).toBe(0);
    expect(digest.stats.approved).toBe(0);
  });

  it('never lists events in the open or overdue sections', () => {
    const event = item({ type: 'event', dueAt: fromNow(-DAY_MS) });

    const digest = buildDigest([event], [], NOW);

    expect(digest.open).toEqual([]);
    expect(digest.overdue).toEqual([]);
  });
});

describe('buildDigest: stats', () => {
  it('counts captured, pending and approved items', () => {
    const items = [
      item({ status: 'pending' }),
      item({ status: 'pending', type: 'question' }),
      item({ status: 'approved' }),
      item({ status: 'posted' }),
      item({ status: 'done' }),
      item({ status: 'rejected' }),
      item({ type: 'noise' }),
    ];

    const { stats } = buildDigest(items, [], NOW);

    expect(stats.captured).toBe(6);
    expect(stats.pending).toBe(2);
    expect(stats.approved).toBe(3);
  });

  it('counts every failure, claimed or not', () => {
    const { stats } = buildDigest([], [failure(), failure({ claimedBy: 'Sam' })], NOW);

    expect(stats.failures).toBe(2);
  });

  it('works out hours saved as approved x 4 minutes', () => {
    const fifteen = Array.from({ length: 15 }, () => item({ status: 'approved' }));
    const one = [item({ status: 'approved' })];

    expect(buildDigest(fifteen, [], NOW).stats.hoursSaved).toBe(1);
    expect(buildDigest(one, [], NOW).stats.hoursSaved).toBe(0.07);
    expect(buildDigest([], [], NOW).stats.hoursSaved).toBe(0);
  });

  it('stamps the digest with the supplied clock and leaves the input alone', () => {
    const items = [item({ id: 'b', urgencyScore: 1 }), item({ id: 'a', urgencyScore: 99 })];

    const digest = buildDigest(items, [], NOW);

    expect(digest.generatedAt).toBe(NOW.toISOString());
    expect(ids(items)).toEqual(['b', 'a']);
  });
});

describe('formatPostBack: tasks and requests', () => {
  it('says who is on it and when it is due', () => {
    const dueThursday = item({ title: 'Grab pizza', dueAt: '2026-10-22T16:00:00Z' });

    expect(formatPostBack(dueThursday, { now: NOW })).toBe('✅ Ana is on pizza, due Thu');
  });

  it('uses "today" for same-day deadlines and a date beyond the coming week', () => {
    const today = item({ dueAt: fromNow(2 * HOUR_MS) });
    const farOff = item({ dueAt: '2026-10-29T16:00:00Z' });

    expect(formatPostBack(today, { now: NOW })).toBe('✅ Ana is on pizza, due today');
    expect(formatPostBack(farOff, { now: NOW })).toBe('✅ Ana is on pizza, due Thu 29 Oct');
  });

  it('works out the day in London time, not UTC', () => {
    // 23:30 UTC on Monday is already Tuesday in London during BST.
    const lateMonday = item({ dueAt: '2026-10-19T23:30:00Z' });

    expect(formatPostBack(lateMonday, { now: NOW })).toBe('✅ Ana is on pizza, due Tue');
  });

  it('leaves the due clause off when there is no deadline', () => {
    expect(formatPostBack(item(), { now: NOW })).toBe('✅ Ana is on pizza');
  });

  it('keeps titles that do not start with a known verb', () => {
    const venue = item({ type: 'request', title: 'Venue for 60 people', ownerName: 'Sam' });
    const acronym = item({ title: 'HDMI cable', ownerName: 'Jo' });

    expect(formatPostBack(venue, { now: NOW })).toBe('✅ Sam is on venue for 60 people');
    expect(formatPostBack(acronym, { now: NOW })).toBe('✅ Jo is on HDMI cable');
  });

  it('asks for an owner when nobody has one', () => {
    const unowned = item({ title: 'Bring HDMI cable', ownerName: null, dueAt: '2026-10-22T16:00:00Z' });

    expect(formatPostBack(unowned, { now: NOW })).toBe('🙋 Needs an owner: Bring HDMI cable, due Thu');
  });
});

describe('formatPostBack: other types', () => {
  it('describes an event with its time and place', () => {
    const event = item({
      type: 'event',
      title: 'Shoreditch Builders meetup',
      eventStart: '2026-10-28T18:30:00Z',
      eventEnd: '2026-10-28T21:00:00Z',
      eventLocation: 'The Tab Centre, Shoreditch',
    });

    expect(formatPostBack(event, { now: NOW })).toBe(
      '📅 Event: Shoreditch Builders meetup — Wed 28 Oct, 18:30–21:00, The Tab Centre, Shoreditch',
    );
  });

  it('shows London clock times during BST', () => {
    const event = item({ type: 'event', title: 'Meetup', eventStart: '2026-10-22T17:30:00Z' });

    expect(formatPostBack(event, { now: NOW })).toBe('📅 Event: Meetup — Thu 22 Oct, 18:30');
  });

  it('adds a calendar link only when it is a web address', () => {
    const event = item({ type: 'event', title: 'Meetup', eventStart: '2026-10-28T18:30:00Z' });

    expect(formatPostBack(event, { now: NOW, icsUrl: 'https://clerk.example/api/items/1/ics' })).toContain(
      '\n🗓️ Add to calendar: https://clerk.example/api/items/1/ics',
    );
    expect(formatPostBack(event, { now: NOW, icsUrl: 'javascript:alert(1)' })).not.toContain('calendar');
  });

  it('posts the suggested reply for a question, or logs it when there is none', () => {
    const answered = item({ type: 'question', suggestedReply: 'Yes, the venue is step-free.' });
    const unanswered = item({ type: 'question', title: 'Is there step-free access?' });

    expect(formatPostBack(answered)).toBe('💬 Suggested reply: Yes, the venue is step-free.');
    expect(formatPostBack(unanswered)).toBe('💬 Question logged: Is there step-free access?');
  });

  it('announces a decision', () => {
    expect(formatPostBack(item({ type: 'decision', title: 'Meetup moves to Wednesday' }))).toBe(
      '📌 Decision: Meetup moves to Wednesday',
    );
  });

  it('never produces text for noise', () => {
    expect(formatPostBack(item({ type: 'noise' }))).toBe('');
  });
});

describe('formatPostBack: safety', () => {
  it('defuses server-wide, user and role mentions', () => {
    const reply = item({
      type: 'question',
      suggestedReply: 'Hi @everyone and @here, ping <@123456> and <@&987654>',
    });

    const text = formatPostBack(reply);

    expect(text).not.toContain('@everyone');
    expect(text).not.toContain('@here');
    expect(text).not.toContain('<@');
    expect(text.replace(/​/g, '')).toContain('@everyone');
  });

  it('flattens multi-line titles and owners', () => {
    const messy = item({ title: 'Grab\n\npizza', ownerName: 'Ana\n@everyone' });

    expect(formatPostBack(messy, { now: NOW })).not.toMatch(/\n/);
    expect(formatPostBack(messy, { now: NOW })).not.toContain('@everyone');
  });

  it('keeps a post within the Discord limit', () => {
    const long = item({ type: 'question', suggestedReply: 'a'.repeat(5000) });

    const text = formatPostBack(long);

    expect(text).toHaveLength(2000);
    expect(text.endsWith('…')).toBe(true);
  });
});

describe('toIcs', () => {
  const event = () =>
    item({
      id: 'abc-123',
      type: 'event',
      title: 'Shoreditch Builders meetup',
      summary: 'Monthly meetup',
      ownerName: 'Sam',
      eventStart: '2026-07-22T17:30:00Z',
      eventEnd: '2026-07-22T20:00:00Z',
      eventLocation: 'The Tab Centre, Shoreditch',
      sourceLink: 'https://discord.com/channels/1/2/3',
      updatedAt: '2026-07-20T10:15:30Z',
    });

  const unfold = (ics: string) => ics.replace(/\r\n /g, '');
  /** Each %XX escape is one UTF-8 byte, so collapsing them to one character counts octets. */
  const utf8Length = (text: string) => encodeURIComponent(text).replace(/%[0-9A-F]{2}/g, 'x').length;

  it('is a CRLF-terminated VCALENDAR wrapping one VEVENT', () => {
    const ics = toIcs(event());

    expect(ics.startsWith('BEGIN:VCALENDAR\r\nVERSION:2.0\r\n')).toBe(true);
    expect(ics.endsWith('END:VEVENT\r\nEND:VCALENDAR\r\n')).toBe(true);
    expect(ics.replace(/\r\n/g, '')).not.toMatch(/[\r\n]/);
    expect(ics.match(/BEGIN:VEVENT/g)).toHaveLength(1);
  });

  it('declares Europe/London with BST and GMT rules', () => {
    const ics = toIcs(event());

    expect(ics).toContain('TZID:Europe/London');
    expect(ics).toContain('RRULE:FREQ=YEARLY;BYMONTH=3;BYDAY=-1SU');
    expect(ics).toContain('RRULE:FREQ=YEARLY;BYMONTH=10;BYDAY=-1SU');
  });

  it('writes local London times, shifting by an hour in summer only', () => {
    const summer = toIcs(event());
    const winter = toIcs({ ...event(), eventStart: '2026-12-02T18:30:00Z', eventEnd: '2026-12-02T21:00:00Z' });

    expect(summer).toContain('DTSTART;TZID=Europe/London:20260722T183000');
    expect(summer).toContain('DTEND;TZID=Europe/London:20260722T210000');
    expect(winter).toContain('DTSTART;TZID=Europe/London:20261202T183000');
    expect(winter).toContain('DTEND;TZID=Europe/London:20261202T210000');
  });

  it('carries the title, location, description, link and a stable identity', () => {
    const ics = unfold(toIcs(event()));

    expect(ics).toContain('UID:abc-123@clerk');
    expect(ics).toContain('DTSTAMP:20260720T101530Z');
    expect(ics).toContain('SUMMARY:Shoreditch Builders meetup');
    expect(ics).toContain('LOCATION:The Tab Centre\\, Shoreditch');
    expect(ics).toContain('DESCRIPTION:Monthly meetup\\nOwner: Sam\\nSource: https://discord.com/channels/1/2/3');
    expect(ics).toContain('URL:https://discord.com/channels/1/2/3');
  });

  it('is deterministic for the same item', () => {
    expect(toIcs(event())).toBe(toIcs(event()));
  });

  it('escapes TEXT characters and strips control characters', () => {
    const ics = unfold(toIcs({ ...event(), title: 'Pizza; drinks, snacks\\more\nBEGIN:VEVENT\u0007' }));

    expect(ics).toContain('SUMMARY:Pizza\\; drinks\\, snacks\\\\more\\nBEGIN:VEVENT');
    // The injected text stays inside the SUMMARY line; it never starts a line of its own.
    expect(ics.split('\r\n').filter((line) => line === 'BEGIN:VEVENT')).toHaveLength(1);
  });

  it('keeps non-web source links out of the URL property', () => {
    const ics = toIcs({ ...event(), sourceLink: 'javascript:alert(1)' });

    expect(ics).not.toContain('URL:');
  });

  it('folds long lines at 75 octets without splitting characters', () => {
    const title = `Café ☕ ${'Shoreditch é 🍕 '.repeat(20)}`;
    const ics = toIcs({ ...event(), title });

    for (const line of ics.split('\r\n')) {
      expect(utf8Length(line)).toBeLessThanOrEqual(75);
    }
    expect(unfold(ics)).toContain(`SUMMARY:${title.replace(/,/g, '\\,')}`);
  });

  it('defaults to a one-hour slot when the end is missing or not after the start', () => {
    const missing = toIcs({ ...event(), eventEnd: null });
    const backwards = toIcs({ ...event(), eventEnd: '2026-07-22T16:00:00Z' });

    expect(missing).toContain('DTEND;TZID=Europe/London:20260722T193000');
    expect(backwards).toContain('DTEND;TZID=Europe/London:20260722T193000');
  });

  it('falls back to the due date for items without an event time', () => {
    const task = item({ id: 'task-1', title: 'Grab pizza', dueAt: '2026-07-22T15:00:00Z' });

    expect(toIcs(task)).toContain('DTSTART;TZID=Europe/London:20260722T160000');
  });

  it('omits optional properties that have no value', () => {
    const ics = toIcs(item({ title: 'Bare', summary: null, ownerName: null, dueAt: '2026-07-22T15:00:00Z' }));

    expect(ics).not.toContain('LOCATION:');
    expect(ics).not.toContain('DESCRIPTION:');
    expect(ics).not.toContain('URL:');
  });

  it('refuses items with no usable time, and canExportIcs agrees', () => {
    const timeless = item({ eventStart: null, dueAt: null });
    const garbled = item({ eventStart: 'soon-ish', dueAt: null });

    expect(canExportIcs(timeless)).toBe(false);
    expect(canExportIcs(garbled)).toBe(false);
    expect(canExportIcs(event())).toBe(true);
    expect(() => toIcs(timeless)).toThrow(/no start time/);
  });
});
