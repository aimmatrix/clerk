import type { Item } from '@clerk/core';
import { StoreError, type PostStore } from '../post/store';

export type IcsOutcome =
  | { status: 200; body: string; filename: string }
  | { status: 404 | 422 | 503; body: { error: string } };

export async function renderItemIcs(input: {
  itemId: string;
  store: PostStore;
  canExportIcs: (item: Item) => boolean;
  toIcs: (item: Item) => string;
}): Promise<IcsOutcome> {
  let loaded;
  try {
    loaded = await input.store.load(input.itemId);
  } catch (err) {
    if (err instanceof StoreError && err.status === 404) return { status: 404, body: { error: 'Item not found' } };
    if (err instanceof StoreError && err.status === 503) {
      return { status: 503, body: { error: err.message } };
    }
    return { status: 503, body: { error: 'Could not load this item' } };
  }

  if (!loaded) return { status: 404, body: { error: 'Item not found' } };
  if (!input.canExportIcs(loaded.item)) {
    return { status: 422, body: { error: 'This item has no start time to export' } };
  }

  try {
    return {
      status: 200,
      body: input.toIcs(loaded.item),
      filename: icsFilename(loaded.item.id),
    };
  } catch {
    return { status: 422, body: { error: 'This item has no start time to export' } };
  }
}

function icsFilename(id: string): string {
  const safe = id.replace(/[^a-zA-Z0-9-]/g, '') || 'item';
  return `clerk-${safe}.ics`;
}
