import { rowToItem, type ItemRow } from '../../../../../lib/db';
import type { Item } from '@clerk/core';

/** Contract demo community. Simulator posts never leave the process. */
export const DEMO_COMMUNITY_ID = '00000000-0000-0000-0000-000000000001';

const ITEM_ID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function isItemId(id: string): boolean {
  return ITEM_ID.test(id);
}

export class StoreError extends Error {
  readonly status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = 'StoreError';
    this.status = status;
  }
}

export interface SourceMessage {
  source: 'discord' | 'simulator';
  externalId: string;
  channelId: string | null;
  threadId: string | null;
}

export interface LoadedItem {
  item: Item;
  postChannelId: string | null;
  message: SourceMessage | null;
}

export interface PostStore {
  load(id: string): Promise<LoadedItem | null>;
  /** Conditional on status = approved, then writes an item_events row with action "posted". */
  markPosted(id: string, actor: string, diff: Record<string, unknown>): Promise<Item>;
}

interface MessageSnippet {
  source: 'discord' | 'simulator';
  external_id: string;
  channel_id: string | null;
  thread_id: string | null;
}

interface CommunitySnippet {
  post_channel_id: string | null;
}

interface SupabaseEnv {
  NEXT_PUBLIC_SUPABASE_URL?: string;
  SUPABASE_URL?: string;
  SUPABASE_SERVICE_ROLE_KEY?: string;
}

export function createSupabasePostStoreFromEnv(
  env: SupabaseEnv = process.env,
  fetchImpl?: typeof fetch,
): PostStore {
  const url = env.NEXT_PUBLIC_SUPABASE_URL || env.SUPABASE_URL;
  const serviceKey = env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) {
    return unavailableStore();
  }
  return createSupabasePostStore({ url, serviceKey, fetchImpl });
}

export function createSupabasePostStore(opts: {
  url: string;
  serviceKey: string;
  fetchImpl?: typeof fetch;
}): PostStore {
  const base = opts.url.replace(/\/$/, '');
  const fetchImpl = opts.fetchImpl ?? fetch;
  const key = opts.serviceKey;

  async function rest<T>(path: string, init?: { method?: string; body?: unknown; prefer?: string }): Promise<T> {
    let response: Response;
    try {
      response = await fetchImpl(`${base}/rest/v1/${path}`, {
        method: init?.method ?? 'GET',
        headers: {
          apikey: key,
          authorization: `Bearer ${key}`,
          accept: 'application/json',
          'content-type': 'application/json',
          ...(init?.prefer ? { prefer: init.prefer } : {}),
        },
        body: init?.body === undefined ? undefined : JSON.stringify(init.body),
      });
    } catch {
      throw new StoreError('Database is unreachable', 503);
    }

    const payload = await response.json().catch(() => null);
    if (!response.ok) {
      const code = payload && typeof payload === 'object' && 'code' in payload ? String(payload.code) : '';
      if (code === '22P02') throw new StoreError('Item not found', 404);
      throw new StoreError('Database request failed', response.status >= 500 ? 503 : 502);
    }
    return payload as T;
  }

  return {
    async load(id) {
      if (!isItemId(id)) return null;
      const items = await rest<ItemRow[]>(`items?id=eq.${encodeURIComponent(id)}&select=*`);
      const row = items[0];
      if (!row) return null;

      const [messages, communities] = await Promise.all([
        row.message_id
          ? rest<MessageSnippet[]>(
              `messages?id=eq.${encodeURIComponent(row.message_id)}&select=source,external_id,channel_id,thread_id`,
            )
          : Promise.resolve([]),
        rest<CommunitySnippet[]>(
          `communities?id=eq.${encodeURIComponent(row.community_id)}&select=post_channel_id`,
        ),
      ]);

      const message = messages[0];
      return {
        item: rowToItem(row),
        postChannelId: communities[0]?.post_channel_id ?? null,
        message: message
          ? {
              source: message.source,
              externalId: message.external_id,
              channelId: message.channel_id,
              threadId: message.thread_id,
            }
          : null,
      };
    },

    async markPosted(id, actor, diff) {
      if (!isItemId(id)) throw new StoreError('Item not found', 404);
      const rows = await rest<ItemRow[]>(
        `items?id=eq.${encodeURIComponent(id)}&status=eq.approved`,
        {
          method: 'PATCH',
          body: { status: 'posted' },
          prefer: 'return=representation',
        },
      );
      const row = rows[0];
      if (!row) throw new StoreError('Item is no longer approved', 409);

      await rest(`item_events`, {
        method: 'POST',
        prefer: 'return=representation',
        body: {
          item_id: id,
          action: 'posted',
          actor,
          diff,
        },
      });

      return rowToItem({ ...row, status: 'posted' });
    },
  };
}

function unavailableStore(): PostStore {
  const fail = () => Promise.reject(new StoreError('Database is not configured', 503));
  return { load: fail, markPosted: fail };
}
