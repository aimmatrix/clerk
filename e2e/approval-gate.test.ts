/**
 * The post-back gate, without Discord or Supabase.
 * A pending item must 409. An approved demo-community item is marked posted
 * and must not call Discord.
 */
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { formatPostBack, type Item } from '@clerk/core';
import { postApprovedItem } from '../apps/web/app/api/items/[id]/post/post-item';
import type { LoadedItem, PostStore } from '../apps/web/app/api/items/[id]/post/store';

const DEMO = '00000000-0000-0000-0000-000000000001';

function item(status: Item['status']): Item {
  return {
    id: '10000000-0000-4000-8000-000000000001',
    communityId: DEMO,
    messageId: '10000000-0000-4000-8000-000000000002',
    type: 'task',
    title: 'Bring pizza',
    summary: 'Ana will bring pizza.',
    ownerName: 'Ana',
    priority: 'P1',
    dueAt: null,
    confidence: 0.9,
    urgencyScore: 50,
    status,
    suggestedReply: null,
    eventStart: null,
    eventEnd: null,
    eventLocation: null,
    sourceLink: null,
    createdAt: '2026-10-22T18:00:00.000Z',
    updatedAt: '2026-10-22T18:00:00.000Z',
  };
}

function storeFor(loaded: LoadedItem | null): PostStore & { posted: boolean } {
  const state = { posted: false };
  return {
    get posted() {
      return state.posted;
    },
    async load() {
      return loaded;
    },
    async markPosted(id, _actor, _diff) {
      state.posted = true;
      if (!loaded) throw new Error('missing');
      return { ...loaded.item, id, status: 'posted' };
    },
  };
}

describe('post-back approval gate', () => {
  it('refuses to post an item that has not been approved', async () => {
    let discordCalls = 0;
    const store = storeFor({ item: item('pending'), postChannelId: '123', message: null });
    const outcome = await postApprovedItem({
      itemId: item('pending').id,
      actor: 'lead',
      store,
      discord: {
        postMessage: async () => {
          discordCalls += 1;
          return { id: 'should-not-send' };
        },
      },
      formatPostBack,
      discordToken: 'bot-token',
    });
    assert.equal(outcome.status, 409);
    assert.equal(discordCalls, 0);
    assert.equal(store.posted, false);
  });

  it('marks an approved demo item posted without calling Discord', async () => {
    let discordCalls = 0;
    const store = storeFor({
      item: item('approved'),
      postChannelId: null,
      message: { source: 'simulator', externalId: 'm1', channelId: null, threadId: null },
    });
    const outcome = await postApprovedItem({
      itemId: item('approved').id,
      actor: 'lead',
      store,
      discord: {
        postMessage: async () => {
          discordCalls += 1;
          return { id: 'should-not-send' };
        },
      },
      formatPostBack,
      demoCommunityId: DEMO,
      discordToken: 'bot-token',
    });
    assert.equal(outcome.status, 200);
    assert.equal(outcome.body && 'posted' in outcome.body && outcome.body.posted, true);
    assert.match(outcome.body && 'text' in outcome.body ? outcome.body.text : '', /Ana/);
    assert.equal(discordCalls, 0);
    assert.equal(store.posted, true);
  });
});
