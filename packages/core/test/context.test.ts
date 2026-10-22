import { describe, expect, it } from 'vitest';
import { buildContext } from '../src/context';
import type { IncomingMessage } from '../src/types';

const BASE = Date.parse('2026-10-22T18:00:00Z');
const MINUTE_MS = 60 * 1000;

const minutesAgo = (m: number) => new Date(BASE - m * MINUTE_MS).toISOString();

function message(id: string, overrides: Partial<IncomingMessage> = {}): IncomingMessage {
  return {
    externalId: id,
    channelId: 'general',
    authorName: 'Ana',
    content: `message ${id}`,
    sentAt: minutesAgo(0),
    source: 'simulator',
    ...overrides,
  };
}

const ids = (messages: IncomingMessage[]) => messages.map((m) => m.externalId);

describe('buildContext: same thread', () => {
  it('prefers same-thread messages over nearby channel chatter', () => {
    const msg = message('now', { threadId: 't1', channelId: 'general' });
    const history = [
      message('thread-old', { threadId: 't1', channelId: 'elsewhere', sentAt: minutesAgo(120) }),
      message('chatter-1', { sentAt: minutesAgo(2) }),
      message('chatter-2', { sentAt: minutesAgo(1) }),
      message('thread-new', { threadId: 't1', channelId: 'elsewhere', sentAt: minutesAgo(30) }),
    ];

    expect(ids(buildContext(msg, history, 2))).toEqual(['thread-old', 'thread-new']);
  });

  it('keeps the most recent thread messages when the thread exceeds the cap', () => {
    const msg = message('now', { threadId: 't1' });
    const history = [7, 6, 5, 4, 3, 2, 1].map((n) =>
      message(`t${n}`, { threadId: 't1', sentAt: minutesAgo(n) }),
    );

    expect(ids(buildContext(msg, history))).toEqual(['t5', 't4', 't3', 't2', 't1']);
  });

  it('ignores other threads', () => {
    const msg = message('now', { threadId: 't1', channelId: undefined });
    const history = [message('other', { threadId: 't2', channelId: undefined, sentAt: minutesAgo(1) })];

    expect(buildContext(msg, history)).toEqual([]);
  });
});

describe('buildContext: reply chain', () => {
  it('follows replies upwards even when the parents are old and elsewhere', () => {
    const msg = message('now', { replyToExternalId: 'b', channelId: 'general' });
    const history = [
      message('a', { channelId: 'other', sentAt: minutesAgo(600) }),
      message('b', { channelId: 'other', replyToExternalId: 'a', sentAt: minutesAgo(300) }),
      message('unrelated', { channelId: 'other', sentAt: minutesAgo(200) }),
    ];

    expect(ids(buildContext(msg, history))).toEqual(['a', 'b']);
  });

  it('stops at a missing parent', () => {
    const msg = message('now', { replyToExternalId: 'b', channelId: undefined });
    const history = [message('b', { replyToExternalId: 'gone', channelId: undefined, sentAt: minutesAgo(5) })];

    expect(ids(buildContext(msg, history))).toEqual(['b']);
  });

  it('survives a reply loop', () => {
    const msg = message('now', { replyToExternalId: 'a', channelId: undefined });
    const history = [
      message('a', { replyToExternalId: 'b', channelId: undefined, sentAt: minutesAgo(5) }),
      message('b', { replyToExternalId: 'a', channelId: undefined, sentAt: minutesAgo(6) }),
    ];

    expect(ids(buildContext(msg, history))).toEqual(['b', 'a']);
  });
});

describe('buildContext: same channel', () => {
  it('includes messages up to ten minutes earlier, and no further', () => {
    const msg = message('now');
    const history = [
      message('exactly-10', { sentAt: minutesAgo(10) }),
      message('11-min', { sentAt: minutesAgo(11) }),
      message('1-min', { sentAt: minutesAgo(1) }),
    ];

    expect(ids(buildContext(msg, history))).toEqual(['exactly-10', '1-min']);
  });

  it('ignores other channels', () => {
    const history = [message('elsewhere', { channelId: 'random', sentAt: minutesAgo(1) })];

    expect(buildContext(message('now'), history)).toEqual([]);
  });

  it('has no channel tier when the message has no channel', () => {
    const msg = message('now', { channelId: undefined });
    const history = [message('x', { channelId: undefined, sentAt: minutesAgo(1) })];

    expect(buildContext(msg, history)).toEqual([]);
  });
});

describe('buildContext: ordering, limits and edge cases', () => {
  it('fills tiers in order: thread, then reply chain, then channel', () => {
    const msg = message('now', { threadId: 't1', replyToExternalId: 'parent' });
    const history = [
      message('thread', { threadId: 't1', sentAt: minutesAgo(9) }),
      message('parent', { channelId: 'other', sentAt: minutesAgo(200) }),
      message('chatter-old', { sentAt: minutesAgo(8) }),
      message('chatter-new', { sentAt: minutesAgo(1) }),
    ];

    expect(ids(buildContext(msg, history, 3))).toEqual(['parent', 'thread', 'chatter-new']);
  });

  it('returns messages oldest first', () => {
    const msg = message('now');
    const history = [
      message('newest', { sentAt: minutesAgo(1) }),
      message('oldest', { sentAt: minutesAgo(5) }),
      message('middle', { sentAt: minutesAgo(3) }),
    ];

    expect(ids(buildContext(msg, history))).toEqual(['oldest', 'middle', 'newest']);
  });

  it('never repeats a message that matches several tiers', () => {
    const msg = message('now', { threadId: 't1', replyToExternalId: 'p' });
    const history = [message('p', { threadId: 't1', sentAt: minutesAgo(1) })];

    expect(ids(buildContext(msg, history))).toEqual(['p']);
  });

  it('excludes the message itself and anything sent after it', () => {
    const msg = message('now');
    const history = [
      message('now'),
      message('later', { sentAt: new Date(BASE + MINUTE_MS).toISOString() }),
      message('before', { sentAt: minutesAgo(1) }),
    ];

    expect(ids(buildContext(msg, history))).toEqual(['before']);
  });

  it('caps at five by default and honours an explicit max', () => {
    const history = Array.from({ length: 8 }, (_, i) => message(`m${i}`, { sentAt: minutesAgo(i + 1) }));

    expect(buildContext(message('now'), history)).toHaveLength(5);
    expect(buildContext(message('now'), history, 2)).toHaveLength(2);
    expect(buildContext(message('now'), history, 0)).toEqual([]);
  });

  it('does not mutate its inputs', () => {
    const history = [message('b', { sentAt: minutesAgo(1) }), message('a', { sentAt: minutesAgo(2) })];
    const snapshot = JSON.stringify(history);

    buildContext(message('now'), history);

    expect(JSON.stringify(history)).toBe(snapshot);
  });

  it('copes with empty history and unparseable timestamps', () => {
    expect(buildContext(message('now'), [])).toEqual([]);

    const msg = message('now', { sentAt: 'not a date', threadId: 't1' });
    const history = [message('x', { threadId: 't1', sentAt: 'also not a date' })];
    expect(ids(buildContext(msg, history))).toEqual(['x']);
  });
});
