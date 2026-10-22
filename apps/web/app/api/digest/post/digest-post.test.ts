import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import type { Digest, Item } from '@clerk/core';
import { digestToDiscordMarkdown } from '../../../../components/clerk/digest/markdown';
import { DiscordRestError, postDiscordMessage, type DiscordPostInput } from '../../../../lib/discord-rest';
import {
  createMemoryThrottle,
  DEMO_COMMUNITY_ID,
  POST_COOLDOWN_MS,
  postDigest,
  type DigestPostInput,
} from './digest-post';

const COMMUNITY_ID = '33333333-3333-4333-8333-333333333333';
const NOW = new Date('2026-10-22T14:00:00.000Z');

function item(overrides: Partial<Item> = {}): Item {
  return {
    id: '11111111-1111-4111-8111-111111111111',
    communityId: COMMUNITY_ID,
    messageId: '22222222-2222-4222-8222-222222222222',
    type: 'task',
    title: 'Grab pizza',
    summary: null,
    ownerName: 'Ana',
    priority: 'P1',
    dueAt: '2026-10-23T17:00:00.000Z',
    confidence: 0.92,
    urgencyScore: 55,
    status: 'approved',
    suggestedReply: null,
    eventStart: null,
    eventEnd: null,
    eventLocation: null,
    sourceLink: null,
    createdAt: '2026-10-22T12:00:00.000Z',
    updatedAt: '2026-10-22T12:00:00.000Z',
    ...overrides,
  };
}

function digest(overrides: Partial<Digest> = {}): Digest {
  const open = [item()];
  return {
    generatedAt: NOW.toISOString(),
    open,
    overdue: [],
    unansweredQuestions: [],
    decisions: [],
    stats: { captured: 1, pending: 0, approved: 1, failures: 0, hoursSaved: 0.07 },
    ...overrides,
  };
}

/** What the browser sends after the reviewer approves the preview. */
function approvedBody(d: Digest, communityId = COMMUNITY_ID) {
  return { communityId, actor: 'Sam', content: digestToDiscordMarkdown(d), generatedAt: d.generatedAt };
}

function harness(current: Digest = digest(), overrides: Partial<DigestPostInput> = {}) {
  const posts: DiscordPostInput[] = [];
  const input = (body: unknown): DigestPostInput => ({
    body,
    loadDigest: async () => current,
    loadCommunity: async () => ({ postChannelId: '999' }),
    toMarkdown: digestToDiscordMarkdown,
    discord: {
      postMessage: async (post) => {
        posts.push(post);
        return { id: 'msg-1' };
      },
    },
    throttle: createMemoryThrottle(),
    discordToken: 'bot-token',
    demoCommunityId: DEMO_COMMUNITY_ID,
    now: NOW,
    ...overrides,
  });
  return { posts, input };
}

describe('postDigest', () => {
  it('posts exactly the approved preview to the community channel', async () => {
    const d = digest();
    const { posts, input } = harness(d);
    const out = await postDigest(input(approvedBody(d)));

    assert.equal(out.status, 200);
    assert.deepEqual(out.status === 200 && out.body.simulated, false);
    assert.equal(posts.length, 1);
    assert.equal(posts[0].channelId, '999');
    assert.equal(posts[0].token, 'bot-token');
    assert.equal(posts[0].replyToMessageId, undefined);
    assert.equal(posts[0].content, digestToDiscordMarkdown(d));
  });

  it('answers 409 digest_changed and never calls Discord when the board moved on', async () => {
    const approved = digest();
    const moved = digest({ open: [item(), item({ id: '44444444-4444-4444-8444-444444444444', title: 'Book the venue' })] });
    const { posts, input } = harness(moved);

    const out = await postDigest(input(approvedBody(approved)));
    assert.equal(out.status, 409);
    assert.equal(out.status === 409 && out.body.code, 'digest_changed');
    assert.equal(posts.length, 0);
  });

  it('ignores the time the digest was rebuilt, only the data matters', async () => {
    const approved = digest();
    const rebuiltLater = digest({ generatedAt: '2026-10-22T14:05:00.000Z' });
    const { posts, input } = harness(rebuiltLater);

    const out = await postDigest(input(approvedBody(approved)));
    assert.equal(out.status, 200);
    assert.equal(posts.length, 1);
  });

  it('never posts client-supplied text that is not the digest', async () => {
    const d = digest();
    const { posts, input } = harness(d);
    const out = await postDigest(input({ ...approvedBody(d), content: '@everyone free crypto' }));

    assert.equal(out.status, 409);
    assert.equal(posts.length, 0);
  });

  it('simulates the demo community without touching Discord or the community table', async () => {
    const d = digest();
    let looked = false;
    const { posts, input } = harness(d, {
      loadCommunity: async () => {
        looked = true;
        return { postChannelId: '999' };
      },
    });
    const out = await postDigest(input(approvedBody(d, DEMO_COMMUNITY_ID)));

    assert.equal(out.status, 200);
    assert.equal(out.status === 200 && out.body.simulated, true);
    assert.equal(posts.length, 0);
    assert.equal(looked, false);
  });

  it('still requires the preview to match for the demo community', async () => {
    const d = digest();
    const { input } = harness(d);
    const out = await postDigest(input({ ...approvedBody(d, DEMO_COMMUNITY_ID), content: 'something else' }));
    assert.equal(out.status, 409);
  });

  it('rejects malformed bodies with 400', async () => {
    const d = digest();
    const { posts, input } = harness(d);
    for (const body of [
      null,
      'nope',
      {},
      { ...approvedBody(d), communityId: 'not-a-uuid' },
      { ...approvedBody(d), actor: '   ' },
      { ...approvedBody(d), actor: 'x'.repeat(121) },
      { ...approvedBody(d), content: '' },
      { ...approvedBody(d), generatedAt: 'yesterday-ish' },
    ]) {
      const out = await postDigest(input(body));
      assert.equal(out.status, 400, JSON.stringify(body)?.slice(0, 60));
    }
    assert.equal(posts.length, 0);
  });

  it('404s an unknown community', async () => {
    const d = digest();
    const { posts, input } = harness(d, { loadDigest: async () => null });
    const out = await postDigest(input(approvedBody(d)));
    assert.equal(out.status, 404);
    assert.equal(posts.length, 0);
  });

  it('422s when the community has no post channel and 503s without a bot token', async () => {
    const d = digest();
    const noChannel = harness(d, { loadCommunity: async () => ({ postChannelId: null }) });
    assert.equal((await postDigest(noChannel.input(approvedBody(d)))).status, 422);

    const noToken = harness(d, { discordToken: undefined });
    assert.equal((await postDigest(noToken.input(approvedBody(d)))).status, 503);

    assert.equal(noChannel.posts.length + noToken.posts.length, 0);
  });

  it('throttles a second real post, and the throttle expires', async () => {
    const d = digest();
    const throttle = createMemoryThrottle();
    const { posts, input } = harness(d, { throttle });

    assert.equal((await postDigest(input(approvedBody(d)))).status, 200);
    const second = await postDigest(input(approvedBody(d)));
    assert.equal(second.status, 429);
    assert.ok(second.status === 429 && (second.body.retryAfterSeconds ?? 0) > 0);
    assert.equal(posts.length, 1);

    const later = new Date(NOW.getTime() + POST_COOLDOWN_MS + 1);
    assert.equal((await postDigest({ ...input(approvedBody(d)), now: later })).status, 200);
    assert.equal(posts.length, 2);
  });

  it('does not throttle a retry after Discord failed', async () => {
    const d = digest();
    let calls = 0;
    const { input } = harness(d, {
      discord: {
        postMessage: async () => {
          calls += 1;
          if (calls === 1) throw new DiscordRestError('nope', 403);
          return { id: 'msg-2' };
        },
      },
    });

    const first = await postDigest(input(approvedBody(d)));
    assert.equal(first.status, 502);
    assert.equal((await postDigest(input(approvedBody(d)))).status, 200);
  });

  it('maps Discord errors to safe messages', async () => {
    const d = digest();
    const cases: Array<[number, number]> = [
      [401, 503],
      [403, 502],
      [404, 502],
      [429, 502],
      [500, 502],
    ];
    for (const [discordStatus, expected] of cases) {
      const { input } = harness(d, {
        discord: {
          postMessage: async () => {
            throw new DiscordRestError('secret internals', discordStatus);
          },
        },
      });
      const out = await postDigest(input(approvedBody(d)));
      assert.equal(out.status, expected, `discord ${discordStatus}`);
      assert.ok(!JSON.stringify(out.body).includes('secret internals'));
    }
  });

  it('reports a store outage as 503 and other store faults as 502', async () => {
    const d = digest();
    const down = harness(d, {
      loadDigest: async () => {
        throw Object.assign(new Error('db down'), { status: 503 });
      },
    });
    assert.equal((await postDigest(down.input(approvedBody(d)))).status, 503);

    const broken = harness(d, {
      loadDigest: async () => {
        throw new Error('boom');
      },
    });
    assert.equal((await postDigest(broken.input(approvedBody(d)))).status, 502);
  });

  it('keeps chat-supplied mentions out of the posted text', async () => {
    const d = digest({ open: [item({ title: '@everyone bring <@123456> snacks' })] });
    const { posts, input } = harness(d);
    assert.equal((await postDigest(input(approvedBody(d)))).status, 200);
    assert.ok(!/@(?!​)/.test(posts[0].content), 'raw mention reached Discord');
  });
});

describe('Discord delivery', () => {
  it('sends the digest with mentions disabled', async () => {
    const sent: { url: string; body: Record<string, unknown> }[] = [];
    const fetchImpl: typeof fetch = async (url, init) => {
      sent.push({ url: String(url), body: JSON.parse(String(init?.body)) });
      return new Response(JSON.stringify({ id: 'm1' }), { status: 200 });
    };

    const d = digest();
    const { input } = harness(d, {
      discord: {
        postMessage: (post) => postDiscordMessage({ ...post, fetchImpl }),
      },
    });
    assert.equal((await postDigest(input(approvedBody(d)))).status, 200);

    assert.equal(sent.length, 1);
    assert.ok(sent[0].url.endsWith('/channels/999/messages'));
    assert.deepEqual(sent[0].body.allowed_mentions, { parse: [] });
    assert.equal(sent[0].body.message_reference, undefined);
  });
});
