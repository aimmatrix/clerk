import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import type { Item } from '@clerk/core';
import { DiscordRestError, postDiscordMessage } from '../../../../../lib/discord-rest';
import { postApprovedItem } from './post-item';
import { createSupabasePostStore, DEMO_COMMUNITY_ID, type LoadedItem, type PostStore } from './store';

const ITEM_ID = '11111111-1111-4111-8111-111111111111';
const MESSAGE_ID = '22222222-2222-4222-8222-222222222222';
const COMMUNITY_ID = '33333333-3333-4333-8333-333333333333';

function item(overrides: Partial<Item> = {}): Item {
  return {
    id: ITEM_ID,
    communityId: COMMUNITY_ID,
    messageId: MESSAGE_ID,
    type: 'task',
    title: 'Grab pizza',
    summary: 'Ana volunteered',
    ownerName: 'Ana',
    priority: 'P2',
    dueAt: '2026-10-22T17:00:00.000Z',
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

function loaded(overrides: Partial<LoadedItem> = {}): LoadedItem {
  return {
    item: item(),
    postChannelId: '999',
    message: {
      source: 'discord',
      externalId: '555',
      channelId: '777',
      threadId: null,
    },
    ...overrides,
  };
}

function memoryStore(seed: LoadedItem | null): PostStore & { posted: unknown[] } {
  const posted: unknown[] = [];
  return {
    posted,
    async load() {
      return seed;
    },
    async markPosted(_id, actor, diff) {
      posted.push({ actor, diff });
      if (!seed) throw new Error('missing');
      return { ...seed.item, status: 'posted' };
    },
  };
}

describe('postDiscordMessage', () => {
  it('posts a reply with mentions disabled', async () => {
    const calls: { url: string; init: RequestInit }[] = [];
    const result = await postDiscordMessage({
      channelId: '777',
      content: '✅ Ana is on pizza, due Thu',
      replyToMessageId: '555',
      token: 'secret-token',
      apiBase: 'https://discord.test/api/v10',
      fetchImpl: async (url, init) => {
        calls.push({ url: String(url), init: init ?? {} });
        return Response.json({ id: '888' });
      },
    });

    assert.equal(result.id, '888');
    assert.equal(calls.length, 1);
    assert.equal(calls[0].url, 'https://discord.test/api/v10/channels/777/messages');
    const headers = calls[0].init.headers as Record<string, string>;
    assert.equal(headers.authorization, 'Bot secret-token');
    const body = JSON.parse(String(calls[0].init.body));
    assert.equal(body.content, '✅ Ana is on pizza, due Thu');
    assert.deepEqual(body.allowed_mentions, { parse: [] });
    assert.deepEqual(body.message_reference, {
      message_id: '555',
      channel_id: '777',
      fail_if_not_exists: false,
    });
    assert.equal(JSON.stringify(body).includes('secret-token'), false);
  });

  it('omits message_reference when there is nothing to reply to', async () => {
    let body: Record<string, unknown> = {};
    await postDiscordMessage({
      channelId: '999',
      content: '📌 Decision: move to Wednesday',
      token: 't',
      fetchImpl: async (_url, init) => {
        body = JSON.parse(String(init?.body));
        return Response.json({ id: '1' });
      },
    });
    assert.equal('message_reference' in body, false);
  });

  it('throws the Discord status and does not invent a message id', async () => {
    await assert.rejects(
      () =>
        postDiscordMessage({
          channelId: '1',
          content: 'hello',
          token: 't',
          fetchImpl: async () => Response.json({ message: 'Missing Access' }, { status: 403 }),
        }),
      (err: unknown) => err instanceof DiscordRestError && err.status === 403,
    );
  });
});

describe('postApprovedItem', () => {
  const formatPostBack = (value: Item) => `POST:${value.title}`;

  it('refuses anything that is not approved and never calls Discord', async () => {
    for (const status of ['pending', 'posted', 'done', 'rejected'] as const) {
      const fetchImpl: typeof fetch = async () => {
        throw new Error('Discord must not be called');
      };
      const store = memoryStore(loaded({ item: item({ status }) }));
      const outcome = await postApprovedItem({
        itemId: ITEM_ID,
        actor: 'Sam',
        store,
        discord: { postMessage: (input) => postDiscordMessage({ ...input, fetchImpl }) },
        formatPostBack,
        discordToken: 't',
      });
      assert.equal(outcome.status, 409);
      assert.equal(store.posted.length, 0);
    }
  });

  it('requires an actor before it loads or posts', async () => {
    let loadedCount = 0;
    const outcome = await postApprovedItem({
      itemId: ITEM_ID,
      actor: '   ',
      store: {
        async load() {
          loadedCount += 1;
          return null;
        },
        async markPosted() {
          throw new Error('no');
        },
      },
      discord: { postMessage: postDiscordMessage },
      formatPostBack,
    });
    assert.equal(outcome.status, 400);
    assert.equal(loadedCount, 0);
  });

  it('marks the simulator community posted without a Discord call', async () => {
    const store = memoryStore(
      loaded({
        item: item({ communityId: DEMO_COMMUNITY_ID }),
        message: { source: 'simulator', externalId: 's1', channelId: '1', threadId: null },
      }),
    );
    const outcome = await postApprovedItem({
      itemId: ITEM_ID,
      actor: 'Sam',
      store,
      discord: {
        postMessage: async () => {
          throw new Error('Discord must not be called');
        },
      },
      formatPostBack,
      discordToken: 't',
    });
    assert.deepEqual(outcome, { status: 200, body: { posted: true, text: 'POST:Grab pizza' } });
    assert.equal(store.posted.length, 1);
    assert.equal((store.posted[0] as { diff: { simulator: boolean } }).diff.simulator, true);
  });

  it('posts a Discord reply, then records posted', async () => {
    const calls: string[] = [];
    const store = memoryStore(loaded());
    const outcome = await postApprovedItem({
      itemId: ITEM_ID,
      actor: 'Sam',
      origin: 'https://clerk.example',
      store,
      discord: {
        postMessage: (input) => {
          calls.push(input.channelId);
          return postDiscordMessage({
            ...input,
            fetchImpl: async () => Response.json({ id: 'discord-msg' }),
          });
        },
      },
      formatPostBack,
      discordToken: 'bot-token',
    });

    assert.equal(outcome.status, 200);
    if (outcome.status === 200) assert.equal(outcome.body.text, 'POST:Grab pizza');
    assert.deepEqual(calls, ['777']);
    const diff = (store.posted[0] as { actor: string; diff: { discordMessageId: string } }).diff;
    assert.equal(diff.discordMessageId, 'discord-msg');
  });

  it('falls back to the community channel when the reply channel is missing', async () => {
    const calls: { channelId: string; reply?: string }[] = [];
    const store = memoryStore(loaded());
    const outcome = await postApprovedItem({
      itemId: ITEM_ID,
      actor: 'Sam',
      store,
      discord: {
        async postMessage(input) {
          calls.push({ channelId: input.channelId, reply: input.replyToMessageId });
          if (input.replyToMessageId) throw new DiscordRestError('Missing Access', 403);
          return { id: 'fallback-msg' };
        },
      },
      formatPostBack,
      discordToken: 't',
    });

    assert.equal(outcome.status, 200);
    assert.deepEqual(calls, [
      { channelId: '777', reply: '555' },
      { channelId: '999', reply: undefined },
    ]);
  });

  it('does not mark the item posted when Discord rejects it', async () => {
    const store = memoryStore(loaded({ message: null, postChannelId: '999' }));
    const outcome = await postApprovedItem({
      itemId: ITEM_ID,
      actor: 'Sam',
      store,
      discord: {
        postMessage: (input) =>
          postDiscordMessage({
            ...input,
            fetchImpl: async () => Response.json({ message: 'Missing Access' }, { status: 403 }),
          }),
      },
      formatPostBack,
      discordToken: 't',
    });
    assert.equal(outcome.status, 502);
    assert.equal(store.posted.length, 0);
  });

  it('treats a simulator-sourced message as local even in a real community', async () => {
    const store = memoryStore(
      loaded({
        message: { source: 'simulator', externalId: 'sim-1', channelId: '777', threadId: null },
      }),
    );
    const outcome = await postApprovedItem({
      itemId: ITEM_ID,
      actor: 'Sam',
      store,
      discord: {
        async postMessage() {
          throw new Error('Discord must not be called');
        },
      },
      formatPostBack,
      discordToken: 't',
    });
    assert.equal(outcome.status, 200);
    assert.equal(store.posted.length, 1);
  });

  it('does not post an empty line', async () => {
    const store = memoryStore(loaded());
    let called = 0;
    const outcome = await postApprovedItem({
      itemId: ITEM_ID,
      actor: 'Sam',
      store,
      discord: {
        async postMessage() {
          called += 1;
          return { id: 'x' };
        },
      },
      formatPostBack: () => '   ',
      discordToken: 't',
    });
    assert.equal(outcome.status, 422);
    assert.equal(called, 0);
    assert.equal(store.posted.length, 0);
  });

  it('does not call Discord when the bot token is missing', async () => {
    const store = memoryStore(loaded());
    let called = 0;
    const outcome = await postApprovedItem({
      itemId: ITEM_ID,
      actor: 'Sam',
      store,
      discord: {
        async postMessage() {
          called += 1;
          return { id: 'x' };
        },
      },
      formatPostBack,
    });
    assert.equal(outcome.status, 503);
    assert.equal(called, 0);
    assert.equal(store.posted.length, 0);
  });

  it('replies in the source thread when the message has one', async () => {
    const store = memoryStore(
      loaded({
        message: { source: 'discord', externalId: '555', channelId: '777', threadId: '4242' },
      }),
    );
    let channelId = '';
    await postApprovedItem({
      itemId: ITEM_ID,
      actor: 'Sam',
      store,
      discord: {
        async postMessage(input) {
          channelId = input.channelId;
          return { id: 'thread-msg' };
        },
      },
      formatPostBack,
      discordToken: 't',
    });
    assert.equal(channelId, '4242');
  });

  it('does not call Discord when no channel is configured', async () => {
    const store = memoryStore(loaded({ message: null, postChannelId: null }));
    let called = 0;
    const outcome = await postApprovedItem({
      itemId: ITEM_ID,
      actor: 'Sam',
      store,
      discord: {
        async postMessage() {
          called += 1;
          return { id: 'nope' };
        },
      },
      formatPostBack,
      discordToken: 't',
    });
    assert.equal(outcome.status, 422);
    assert.equal(called, 0);
  });
});

describe('supabase post store', () => {
  it('loads an item and only patches rows that are still approved', async () => {
    const calls: { url: string; method: string; body?: unknown }[] = [];
    const row = {
      id: ITEM_ID,
      community_id: DEMO_COMMUNITY_ID,
      message_id: MESSAGE_ID,
      type: 'task',
      title: 'Grab pizza',
      summary: null,
      owner_name: 'Ana',
      priority: 'P2',
      due_at: '2026-10-22T17:00:00.000Z',
      confidence: 0.9,
      urgency_score: 40,
      status: 'approved',
      suggested_reply: null,
      event_start: null,
      event_end: null,
      event_location: null,
      source_link: null,
      created_at: '2026-10-22T12:00:00.000Z',
      updated_at: '2026-10-22T12:00:00.000Z',
    };

    const store = createSupabasePostStore({
      url: 'https://db.example',
      serviceKey: 'service-key',
      fetchImpl: async (url, init) => {
        const href = String(url);
        const method = init?.method ?? 'GET';
        const body = init?.body ? JSON.parse(String(init.body)) : undefined;
        calls.push({ url: href, method, body });
        const headers = init?.headers as Record<string, string>;
        assert.equal(headers.authorization, 'Bearer service-key');
        assert.equal(headers.apikey, 'service-key');

        if (href.includes('/items?') && method === 'GET') return Response.json([row]);
        if (href.includes('/messages?')) {
          return Response.json([
            { source: 'discord', external_id: '555', channel_id: '777', thread_id: null },
          ]);
        }
        if (href.includes('/communities?')) return Response.json([{ post_channel_id: '999' }]);
        if (method === 'PATCH') {
          assert.equal(href.includes('status=eq.approved'), true);
          return Response.json([{ ...row, status: 'posted' }]);
        }
        if (href.includes('/item_events')) {
          assert.equal(body.action, 'posted');
          assert.equal(body.actor, 'Sam');
          return Response.json([{ id: 'event-1' }], { status: 201 });
        }
        return Response.json({ message: 'unexpected' }, { status: 500 });
      },
    });

    const loadedItem = await store.load(ITEM_ID);
    assert.equal(loadedItem?.item.ownerName, 'Ana');
    assert.equal(loadedItem?.item.status, 'approved');
    assert.equal(loadedItem?.postChannelId, '999');
    assert.equal(loadedItem?.message?.externalId, '555');

    const posted = await store.markPosted(ITEM_ID, 'Sam', { text: 'hello' });
    assert.equal(posted.status, 'posted');
    assert.equal(calls.some((call) => call.method === 'PATCH' && call.url.includes('status=eq.approved')), true);
    assert.equal(calls.some((call) => call.url.includes('/item_events')), true);
  });
});
