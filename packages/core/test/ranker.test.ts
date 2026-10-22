import { describe, expect, it } from 'vitest';
import { rankUrgency } from '../src/ranker';
import type { ExtractedItem, Item } from '../src/types';

const NOW = new Date('2026-10-22T18:00:00Z');
const HOUR_MS = 60 * 60 * 1000;

const hoursFromNow = (h: number) => new Date(NOW.getTime() + h * HOUR_MS).toISOString();

function extracted(overrides: Partial<ExtractedItem> = {}): ExtractedItem {
  return {
    type: 'task',
    title: 'Bring the extension leads',
    summary: 'Someone to bring extension leads',
    owner_name: null,
    priority: 'P2',
    due_at: null,
    confidence: 0.9,
    suggested_reply: null,
    event: null,
    reasoning: 'Volunteer offer',
    ...overrides,
  };
}

function stored(overrides: Partial<Item> = {}): Item {
  return {
    id: 'item-1',
    communityId: 'community-1',
    messageId: 'message-1',
    type: 'task',
    title: 'Bring the extension leads',
    summary: 'Someone to bring extension leads',
    ownerName: null,
    priority: 'P2',
    dueAt: null,
    confidence: 0.9,
    urgencyScore: 0,
    status: 'pending',
    suggestedReply: null,
    eventStart: null,
    eventEnd: null,
    eventLocation: null,
    sourceLink: null,
    createdAt: hoursFromNow(-1),
    updatedAt: hoursFromNow(-1),
    ...overrides,
  };
}

describe('rankUrgency: priority base', () => {
  it.each([
    ['P0', 70],
    ['P1', 50],
    ['P2', 30],
    ['P3', 10],
  ] as const)('scores %s as %i with no modifiers', (priority, expected) => {
    expect(rankUrgency(extracted({ priority }), NOW)).toBe(expected);
  });
});

describe('rankUrgency: due proximity', () => {
  it('adds nothing without a due date', () => {
    expect(rankUrgency(extracted({ due_at: null }), NOW)).toBe(30);
  });

  it('adds nothing beyond 72 hours', () => {
    expect(rankUrgency(extracted({ due_at: hoursFromNow(72.01) }), NOW)).toBe(30);
  });

  it('adds 15 within 72 hours, inclusive of the boundary', () => {
    expect(rankUrgency(extracted({ due_at: hoursFromNow(72) }), NOW)).toBe(45);
    expect(rankUrgency(extracted({ due_at: hoursFromNow(24.01) }), NOW)).toBe(45);
  });

  it('adds 25 within 24 hours, inclusive of the boundary', () => {
    expect(rankUrgency(extracted({ due_at: hoursFromNow(24) }), NOW)).toBe(55);
    expect(rankUrgency(extracted({ due_at: hoursFromNow(1) }), NOW)).toBe(55);
  });

  it('treats a deadline exactly now as due within 24 hours, not overdue', () => {
    expect(rankUrgency(extracted({ due_at: NOW.toISOString() }), NOW)).toBe(55);
  });

  it('adds 30 once overdue', () => {
    expect(rankUrgency(extracted({ due_at: hoursFromNow(-0.01) }), NOW)).toBe(60);
    expect(rankUrgency(extracted({ due_at: hoursFromNow(-500) }), NOW)).toBe(60);
  });

  it('ignores an unparseable due date', () => {
    expect(rankUrgency(extracted({ due_at: 'next Thursday-ish' }), NOW)).toBe(30);
  });
});

describe('rankUrgency: type weight', () => {
  it('adds 5 for a request', () => {
    expect(rankUrgency(extracted({ type: 'request' }), NOW)).toBe(35);
  });

  it('adds nothing for tasks, events or decisions', () => {
    for (const type of ['task', 'event', 'decision'] as const) {
      expect(rankUrgency(extracted({ type }), NOW)).toBe(30);
    }
  });

  it('gives a fresh extracted question no age bonus', () => {
    expect(rankUrgency(extracted({ type: 'question' }), NOW)).toBe(30);
  });

  it('adds 10 to a pending question older than 12 hours', () => {
    const q = stored({ type: 'question', createdAt: hoursFromNow(-12.01) });
    expect(rankUrgency(q, NOW)).toBe(40);
  });

  it('adds nothing to a question at exactly 12 hours old', () => {
    const q = stored({ type: 'question', createdAt: hoursFromNow(-12) });
    expect(rankUrgency(q, NOW)).toBe(30);
  });

  it('still counts an approved but unposted question as unanswered', () => {
    const q = stored({ type: 'question', status: 'approved', createdAt: hoursFromNow(-30) });
    expect(rankUrgency(q, NOW)).toBe(40);
  });

  it.each(['posted', 'done', 'rejected'] as const)(
    'does not boost a %s question',
    (status) => {
      const q = stored({ type: 'question', status, createdAt: hoursFromNow(-30) });
      expect(rankUrgency(q, NOW)).toBe(30);
    },
  );

  it('does not apply the stale-question bonus to other types', () => {
    const t = stored({ type: 'task', createdAt: hoursFromNow(-30) });
    expect(rankUrgency(t, NOW)).toBe(30);
  });

  it('ignores an unparseable createdAt', () => {
    const q = stored({ type: 'question', createdAt: 'not a date' });
    expect(rankUrgency(q, NOW)).toBe(30);
  });
});

describe('rankUrgency: keywords', () => {
  it.each(['urgent', 'ASAP', 'Tonight'])('adds 10 for "%s" in the title', (word) => {
    expect(rankUrgency(extracted({ title: `Sort mic ${word}`, summary: 'Mic needed' }), NOW)).toBe(40);
  });

  it('also scans the summary', () => {
    expect(rankUrgency(extracted({ summary: 'Venue needs confirming asap' }), NOW)).toBe(40);
  });

  it('scans title and summary on stored items', () => {
    expect(rankUrgency(stored({ summary: 'This is urgent' }), NOW)).toBe(40);
  });

  it('applies the bonus once however many keywords match', () => {
    const item = extracted({ title: 'Urgent: asap tonight', summary: 'urgent urgent' });
    expect(rankUrgency(item, NOW)).toBe(40);
  });

  it('matches whole words only', () => {
    const item = extracted({ title: 'Check the insurgent demo', summary: 'Tonightly newsletter' });
    expect(rankUrgency(item, NOW)).toBe(30);
  });

  it('handles a null summary on stored items', () => {
    expect(rankUrgency(stored({ summary: null }), NOW)).toBe(30);
  });
});

describe('rankUrgency: combination, cap and noise', () => {
  it('sums every modifier below the cap', () => {
    // P1 50 + due in 48h 15 + request 5 + keyword 10
    const item = extracted({
      type: 'request',
      priority: 'P1',
      due_at: hoursFromNow(48),
      title: 'Venue for 60, asap',
    });
    expect(rankUrgency(item, NOW)).toBe(80);
  });

  it('caps at 100', () => {
    // P0 70 + overdue 30 + request 5 + keyword 10 = 115
    const item = extracted({
      type: 'request',
      priority: 'P0',
      due_at: hoursFromNow(-2),
      title: 'Urgent venue for 60',
    });
    expect(rankUrgency(item, NOW)).toBe(100);
  });

  it('hits the cap exactly without overshooting', () => {
    // P0 70 + overdue 30 = 100
    expect(rankUrgency(extracted({ priority: 'P0', due_at: hoursFromNow(-1) }), NOW)).toBe(100);
  });

  it('never scores below 0 or above 100', () => {
    const lowest = rankUrgency(extracted({ priority: 'P3' }), NOW);
    expect(lowest).toBeGreaterThanOrEqual(0);
    const highest = rankUrgency(
      extracted({ type: 'request', priority: 'P0', due_at: hoursFromNow(-1), title: 'urgent' }),
      NOW,
    );
    expect(highest).toBeLessThanOrEqual(100);
  });

  it('scores noise as 0 regardless of priority, due date or keywords', () => {
    const item = extracted({ type: 'noise', priority: 'P0', due_at: hoursFromNow(-5), title: 'urgent lol' });
    expect(rankUrgency(item, NOW)).toBe(0);
  });

  it('returns an integer', () => {
    const score = rankUrgency(extracted({ due_at: hoursFromNow(10.123) }), NOW);
    expect(Number.isInteger(score)).toBe(true);
  });
});

describe('rankUrgency: determinism', () => {
  it('gives the same score for the same input and clock', () => {
    const item = extracted({ priority: 'P1', due_at: hoursFromNow(30) });
    expect(rankUrgency(item, NOW)).toBe(rankUrgency(item, new Date(NOW)));
  });

  it('does not mutate its input', () => {
    const item = stored({ type: 'question', createdAt: hoursFromNow(-20) });
    const snapshot = structuredClone(item);
    rankUrgency(item, NOW);
    expect(item).toEqual(snapshot);
  });

  it('moves with the supplied clock', () => {
    const item = extracted({ due_at: hoursFromNow(48) });
    const later = new Date(NOW.getTime() + 30 * HOUR_MS); // now due in 18h
    expect(rankUrgency(item, NOW)).toBe(45);
    expect(rankUrgency(item, later)).toBe(55);
  });

  it('defaults to the current time when none is given', () => {
    const item = extracted({ due_at: new Date(Date.now() + 2 * HOUR_MS).toISOString() });
    expect(rankUrgency(item)).toBe(55);
  });

  it('orders a realistic board the way a lead would expect', () => {
    const venue = extracted({ type: 'request', priority: 'P0', due_at: hoursFromNow(20), title: 'Venue for 60' });
    const pizza = extracted({ type: 'task', priority: 'P2', due_at: hoursFromNow(60), title: 'Ana: pizza' });
    const faq = extracted({ type: 'question', priority: 'P3', title: 'Step-free access?' });
    const scores = [venue, pizza, faq].map((i) => rankUrgency(i, NOW));
    expect(scores).toEqual([100, 45, 10]);
    expect([...scores].sort((a, b) => b - a)).toEqual(scores);
  });
});
