import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import type { Item } from '@clerk/core';
import { renderItemIcs } from './ics-item';
import type { LoadedItem, PostStore } from '../post/store';

const ITEM_ID = '11111111-1111-4111-8111-111111111111';

function item(overrides: Partial<Item> = {}): Item {
  return {
    id: ITEM_ID,
    communityId: '33333333-3333-4333-8333-333333333333',
    messageId: '22222222-2222-4222-8222-222222222222',
    type: 'event',
    title: 'Shoreditch meetup',
    summary: 'Venue for 60',
    ownerName: null,
    priority: 'P0',
    dueAt: null,
    confidence: 0.9,
    urgencyScore: 80,
    status: 'approved',
    suggestedReply: null,
    eventStart: '2026-10-28T18:00:00.000Z',
    eventEnd: '2026-10-28T21:00:00.000Z',
    eventLocation: 'Shoreditch',
    sourceLink: null,
    createdAt: '2026-10-22T12:00:00.000Z',
    updatedAt: '2026-10-22T12:00:00.000Z',
    ...overrides,
  };
}

function storeWith(loaded: LoadedItem | null): PostStore {
  return {
    async load() {
      return loaded;
    },
    async markPosted() {
      throw new Error('ics must not write');
    },
  };
}

describe('renderItemIcs', () => {
  it('returns a calendar download for an item with a start time', async () => {
    const loaded: LoadedItem = { item: item(), postChannelId: null, message: null };
    const result = await renderItemIcs({
      itemId: ITEM_ID,
      store: storeWith(loaded),
      canExportIcs: () => true,
      toIcs: (value) => `BEGIN:VCALENDAR\r\nSUMMARY:${value.title}\r\nEND:VCALENDAR\r\n`,
    });

    assert.equal(result.status, 200);
    if (result.status === 200) {
      assert.match(result.body, /BEGIN:VCALENDAR/);
      assert.equal(result.filename, `clerk-${ITEM_ID}.ics`);
    }
  });

  it('refuses an item with no start time and does not render', async () => {
    let rendered = 0;
    const result = await renderItemIcs({
      itemId: ITEM_ID,
      store: storeWith({ item: item({ eventStart: null, dueAt: null }), postChannelId: null, message: null }),
      canExportIcs: () => false,
      toIcs: () => {
        rendered += 1;
        return '';
      },
    });
    assert.equal(result.status, 422);
    assert.equal(rendered, 0);
  });

  it('returns 404 when the item does not exist', async () => {
    const result = await renderItemIcs({
      itemId: ITEM_ID,
      store: storeWith(null),
      canExportIcs: () => true,
      toIcs: () => 'nope',
    });
    assert.equal(result.status, 404);
  });
});
