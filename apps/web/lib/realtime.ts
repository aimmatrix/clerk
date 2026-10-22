'use client';

import { useCallback, useMemo, useSyncExternalStore } from 'react';
import type { Digest, Failure, Item } from '@clerk/core';
import { rowToFailure, rowToItem, rowToMessage, type FailureRow, type ItemRow, type MessageRow, type StoredMessage } from './db';
import { getSupabaseBrowser } from './supabase-browser';

/**
 * Realtime data layer for the board, review queue, failures log and stats bar.
 *
 * One shared feed (one Supabase channel, one REST fetch) per `<table, communityId>`, however many
 * components subscribe. Each feed:
 *   1. fetches the initial list over REST (`/api/items`, `/api/failures`; messages straight from Supabase),
 *   2. subscribes to `community:<id>:<table>` postgres_changes and applies INSERT/UPDATE/DELETE,
 *   3. re-fetches after every (re)subscribe so nothing is missed across a dropped connection,
 *   4. falls back to polling every 5s whenever realtime isn't live (or isn't configured), so the app
 *      still updates without Supabase realtime.
 */

export type ConnectionStatus = 'connecting' | 'live' | 'reconnecting' | 'offline';

export interface FeedState<T> {
  data: T[];
  loading: boolean;
  error: string | null;
  status: ConnectionStatus;
  /** Bumps on every row that newly appears (realtime INSERT or discovered by a re-fetch). Drives the "Live" pulse. */
  insertCount: number;
  lastInsertAt: number | null;
}

interface FeedConfig<T> {
  kind: 'items' | 'failures' | 'messages';
  getId: (value: T) => string;
  fromRow: (row: Record<string, unknown>) => T;
  sort: (a: T, b: T) => number;
  fetchAll: (communityId: string, signal: AbortSignal) => Promise<T[]>;
  /** Keep the existing row's fields that realtime payloads can't carry (e.g. joined message text). */
  merge?: (existing: T | undefined, incoming: T) => T;
  /** Drop out-of-order realtime events. */
  isStale?: (existing: T, incoming: T) => boolean;
  /** Re-fetch (debounced) after any change — for rows whose realtime payload is incomplete. */
  refetchOnChange?: boolean;
  limit?: number;
}

const POLL_MS = 5_000;
const IDLE_STOP_MS = 1_500;
const REFETCH_DEBOUNCE_MS = 250;

const INITIAL_STATE: FeedState<never> = Object.freeze({
  data: [],
  loading: true,
  error: null,
  status: 'connecting',
  insertCount: 0,
  lastInsertAt: null,
}) as FeedState<never>;

const IDLE_STATE: FeedState<never> = Object.freeze({ ...INITIAL_STATE, loading: false, status: 'offline' }) as FeedState<never>;

class Feed<T> {
  private state: FeedState<T> = INITIAL_STATE as FeedState<T>;
  private byId = new Map<string, T>();
  private listeners = new Set<() => void>();
  private refs = 0;
  private running = false;
  private hasLoaded = false;
  private subscribedBefore = false;
  private fetching = false;
  private reloadQueued = false;
  /** Realtime changes that landed while a fetch was in flight; newer than that fetch's snapshot. */
  private touched: Map<string, T | null> | null = null;
  private abort: AbortController | null = null;
  private channel: ReturnType<NonNullable<ReturnType<typeof getSupabaseBrowser>>['channel']> | null = null;
  private stopTimer: ReturnType<typeof setTimeout> | null = null;
  private pollTimer: ReturnType<typeof setInterval> | null = null;
  private refetchTimer: ReturnType<typeof setTimeout> | null = null;

  constructor(
    private readonly cfg: FeedConfig<T>,
    private readonly communityId: string,
  ) {}

  subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener);
    this.refs += 1;
    if (this.stopTimer) {
      clearTimeout(this.stopTimer);
      this.stopTimer = null;
    }
    if (!this.running) this.start();
    return () => {
      this.listeners.delete(listener);
      this.refs -= 1;
      // Delay teardown so React Strict Mode remounts and page-to-page navigation reuse the channel.
      if (this.refs === 0 && !this.stopTimer) this.stopTimer = setTimeout(() => this.stop(), IDLE_STOP_MS);
    };
  };

  getSnapshot = (): FeedState<T> => this.state;

  refresh = (): void => {
    void this.load();
  };

  private set(patch: Partial<FeedState<T>>): void {
    this.state = { ...this.state, ...patch };
    this.listeners.forEach((listener) => listener());
  }

  private publish(extra: Partial<FeedState<T>> = {}): void {
    let data = [...this.byId.values()].sort(this.cfg.sort);
    if (this.cfg.limit && data.length > this.cfg.limit) data = data.slice(-this.cfg.limit);
    this.set({ data, ...extra });
  }

  private start(): void {
    this.running = true;
    this.subscribedBefore = false;
    const hasData = this.hasLoaded;
    this.set({ status: getSupabaseBrowser() ? 'connecting' : 'offline', loading: !hasData });
    this.connect();
    void this.load();
    this.pollTimer = setInterval(() => {
      if (this.state.status === 'live' || (typeof document !== 'undefined' && document.hidden)) return;
      void this.load();
    }, POLL_MS);
    if (typeof window !== 'undefined') {
      window.addEventListener('online', this.onWake);
      document.addEventListener('visibilitychange', this.onWake);
    }
  }

  private stop(): void {
    this.running = false;
    this.stopTimer = null;
    if (this.pollTimer) clearInterval(this.pollTimer);
    if (this.refetchTimer) clearTimeout(this.refetchTimer);
    this.pollTimer = this.refetchTimer = null;
    this.abort?.abort();
    this.abort = null;
    this.fetching = false;
    this.reloadQueued = false;
    this.touched = null;
    if (this.channel) {
      void getSupabaseBrowser()?.removeChannel(this.channel);
      this.channel = null;
    }
    if (typeof window !== 'undefined') {
      window.removeEventListener('online', this.onWake);
      document.removeEventListener('visibilitychange', this.onWake);
    }
  }

  private onWake = (): void => {
    if (typeof document !== 'undefined' && document.hidden) return;
    void this.load();
  };

  private connect(): void {
    const supabase = getSupabaseBrowser();
    if (!supabase) return;
    const table = this.cfg.kind;
    this.channel = supabase
      .channel(`community:${this.communityId}:${table}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table, filter: `community_id=eq.${this.communityId}` },
        (payload) => this.onChange(payload as unknown as { eventType: string; new: Record<string, unknown>; old: Record<string, unknown> }),
      )
      .subscribe((status) => {
        if (!this.running) return;
        if (status === 'SUBSCRIBED') {
          this.set({ status: 'live' });
          // supabase-js rejoins automatically after a drop; close whatever gap we missed.
          if (this.subscribedBefore) void this.load();
          this.subscribedBefore = true;
        } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT' || status === 'CLOSED') {
          this.set({ status: 'reconnecting' });
        }
      });
  }

  private onChange(payload: { eventType: string; new: Record<string, unknown>; old: Record<string, unknown> }): void {
    if (payload.eventType === 'DELETE') {
      const id = payload.old?.id;
      if (id == null) return;
      this.byId.delete(String(id));
      this.touched?.set(String(id), null);
      this.publish();
      return;
    }

    const row = payload.new;
    if (!row || row.id == null) return;
    let incoming: T;
    try {
      incoming = this.cfg.fromRow(row);
    } catch {
      return;
    }
    const id = this.cfg.getId(incoming);
    const existing = this.byId.get(id);
    if (existing && this.cfg.isStale?.(existing, incoming)) return;

    const value = this.cfg.merge ? this.cfg.merge(existing, incoming) : incoming;
    this.byId.set(id, value);
    this.touched?.set(id, value);

    const isNew = !existing && payload.eventType === 'INSERT';
    this.publish(isNew ? { insertCount: this.state.insertCount + 1, lastInsertAt: Date.now() } : {});

    if (this.cfg.refetchOnChange) {
      if (this.refetchTimer) clearTimeout(this.refetchTimer);
      this.refetchTimer = setTimeout(() => void this.load(), REFETCH_DEBOUNCE_MS);
    }
  }

  private async load(): Promise<void> {
    if (!this.running) return;
    if (this.fetching) {
      this.reloadQueued = true;
      return;
    }
    this.fetching = true;
    this.touched = new Map();
    const controller = new AbortController();
    this.abort = controller;
    try {
      const list = await this.cfg.fetchAll(this.communityId, controller.signal);
      if (controller.signal.aborted) return;

      const next = new Map<string, T>();
      for (const value of list) next.set(this.cfg.getId(value), value);
      // Realtime events that arrived mid-fetch are newer than the snapshot.
      for (const [id, value] of this.touched) {
        if (value === null) next.delete(id);
        else next.set(id, value);
      }
      const added = this.hasLoaded ? [...next.keys()].filter((id) => !this.byId.has(id)).length : 0;
      this.byId = next;
      this.hasLoaded = true;
      this.publish({
        loading: false,
        error: null,
        ...(added > 0 ? { insertCount: this.state.insertCount + added, lastInsertAt: Date.now() } : {}),
      });
    } catch (err) {
      if (controller.signal.aborted) return;
      // Keep showing whatever we have; only block the UI with the error if there is nothing to show.
      this.set({ loading: false, error: err instanceof Error ? err.message : String(err) });
    } finally {
      // A stop()/restart while we were in flight already reset this state; don't clobber the new run's.
      if (this.abort === controller) {
        this.abort = null;
        this.fetching = false;
        this.touched = null;
        if (this.reloadQueued && this.running) {
          this.reloadQueued = false;
          void this.load();
        }
      }
    }
  }
}

// ---------------------------------------------------------------------------------------------
// Fetchers + feed configs
// ---------------------------------------------------------------------------------------------

async function getJson<R>(url: string, signal: AbortSignal): Promise<R> {
  const res = await fetch(url, { signal, cache: 'no-store', headers: { accept: 'application/json' } });
  if (!res.ok) throw new Error(`Request to ${url.split('?')[0]} failed (HTTP ${res.status})`);
  return (await res.json()) as R;
}

const time = (value: string): number => {
  const t = Date.parse(value);
  return Number.isNaN(t) ? 0 : t;
};

const itemsConfig: FeedConfig<Item> = {
  kind: 'items',
  getId: (item) => item.id,
  fromRow: (row) => rowToItem(row as unknown as ItemRow),
  // Urgency desc, newest first as the tiebreak — same order as GET /api/items.
  sort: (a, b) => b.urgencyScore - a.urgencyScore || time(b.createdAt) - time(a.createdAt),
  isStale: (existing, incoming) => time(incoming.updatedAt) < time(existing.updatedAt),
  fetchAll: async (communityId, signal) =>
    (await getJson<{ items: Item[] }>(`/api/items?communityId=${encodeURIComponent(communityId)}`, signal)).items,
};

const failuresConfig: FeedConfig<Failure> = {
  kind: 'failures',
  getId: (failure) => failure.id,
  fromRow: (row) => rowToFailure(row as unknown as FailureRow),
  sort: (a, b) => time(b.createdAt) - time(a.createdAt),
  // Realtime rows carry no joined message text; keep what REST gave us and let the debounced re-fetch fill new rows.
  merge: (existing, incoming) => ({
    ...incoming,
    messageContent: incoming.messageContent ?? existing?.messageContent,
    authorName: incoming.authorName ?? existing?.authorName,
  }),
  refetchOnChange: true,
  fetchAll: async (communityId, signal) =>
    (await getJson<{ failures: Failure[] }>(`/api/failures?communityId=${encodeURIComponent(communityId)}`, signal)).failures,
};

const messagesConfig: FeedConfig<StoredMessage> = {
  kind: 'messages',
  getId: (message) => message.id,
  fromRow: (row) => rowToMessage(row as unknown as MessageRow),
  sort: (a, b) => time(a.sentAt) - time(b.sentAt), // chat order: oldest first
  limit: 200,
  // The contract has no GET /api/messages; RLS lets the anon client read the demo community directly.
  fetchAll: async (communityId, signal) => {
    const supabase = getSupabaseBrowser();
    if (!supabase) return [];
    const { data, error } = await supabase
      .from('messages')
      .select('*')
      .eq('community_id', communityId)
      .order('sent_at', { ascending: false })
      .limit(200)
      .abortSignal(signal);
    if (error) throw new Error(error.message);
    return ((data ?? []) as MessageRow[]).map(rowToMessage);
  },
};

const feeds = new Map<string, Feed<unknown>>();

function getFeed<T>(config: FeedConfig<T>, communityId: string): Feed<T> {
  const key = `${config.kind}:${communityId}`;
  let feed = feeds.get(key);
  if (!feed) {
    feed = new Feed(config, communityId) as Feed<unknown>;
    feeds.set(key, feed);
  }
  return feed as Feed<T>;
}

const noop = (): void => undefined;
const noopSubscribe = (): (() => void) => noop;

function useFeed<T>(config: FeedConfig<T>, communityId: string | null | undefined) {
  const feed = communityId ? getFeed(config, communityId) : null;
  const subscribe = feed ? feed.subscribe : noopSubscribe;
  const getSnapshot = useCallback(() => (feed ? feed.getSnapshot() : (IDLE_STATE as FeedState<T>)), [feed]);
  const state = useSyncExternalStore(subscribe, getSnapshot, () => INITIAL_STATE as FeedState<T>);
  return { state, refresh: feed ? feed.refresh : noop };
}

// ---------------------------------------------------------------------------------------------
// Public hooks
// ---------------------------------------------------------------------------------------------

interface FeedMeta {
  loading: boolean;
  /** Last fetch error, if any. Data already on screen is kept. */
  error: string | null;
  status: ConnectionStatus;
  insertCount: number;
  lastInsertAt: number | null;
  refresh: () => void;
}

export interface UseItemsResult extends FeedMeta {
  /** All statuses (including rejected), sorted by urgencyScore desc. Filter by status/type at the call site. */
  items: Item[];
}

export function useItems(communityId: string | null | undefined): UseItemsResult {
  const { state, refresh } = useFeed(itemsConfig, communityId);
  return { items: state.data, ...meta(state), refresh };
}

export interface UseFailuresResult extends FeedMeta {
  /** Newest first. */
  failures: Failure[];
}

export function useFailures(communityId: string | null | undefined): UseFailuresResult {
  const { state, refresh } = useFeed(failuresConfig, communityId);
  return { failures: state.data, ...meta(state), refresh };
}

export interface UseMessagesResult extends FeedMeta {
  /** Chronological (oldest first), capped to the latest 200. */
  messages: StoredMessage[];
}

export function useMessages(communityId: string | null | undefined): UseMessagesResult {
  const { state, refresh } = useFeed(messagesConfig, communityId);
  return { messages: state.data, ...meta(state), refresh };
}

function meta<T>(state: FeedState<T>): Omit<FeedMeta, 'refresh'> {
  return {
    loading: state.loading,
    error: state.error,
    status: state.status,
    insertCount: state.insertCount,
    lastInsertAt: state.lastInsertAt,
  };
}

// ---------------------------------------------------------------------------------------------
// Stats
// ---------------------------------------------------------------------------------------------

/** Brief: hours saved = approved × 4 min ÷ 60. */
export const MINUTES_SAVED_PER_APPROVAL = 4;

export type ClerkStats = Digest['stats'] & {
  /** `captured` excludes noise; noise is tracked separately so the "ignored" counter can tick. */
  noise: number;
  posted: number;
  done: number;
};

/**
 * - `captured`: actionable items (everything except noise).
 * - `pending`: awaiting human review.
 * - `approved`: a human accepted it (approved, posted or done) — this is what "hours saved" counts.
 * - `failures`: everything in the couldn't-handle log.
 */
export function computeStats(items: readonly Item[], failures: readonly Failure[]): ClerkStats {
  let captured = 0;
  let pending = 0;
  let approved = 0;
  let noise = 0;
  let posted = 0;
  let done = 0;
  for (const item of items) {
    if (item.type === 'noise') {
      noise += 1;
      continue;
    }
    captured += 1;
    if (item.status === 'pending') pending += 1;
    if (item.status === 'approved' || item.status === 'posted' || item.status === 'done') approved += 1;
    if (item.status === 'posted') posted += 1;
    if (item.status === 'done') done += 1;
  }
  return {
    captured,
    pending,
    approved,
    failures: failures.length,
    hoursSaved: (approved * MINUTES_SAVED_PER_APPROVAL) / 60,
    noise,
    posted,
    done,
  };
}

function combineStatus(a: ConnectionStatus, b: ConnectionStatus): ConnectionStatus {
  if (a === 'reconnecting' || b === 'reconnecting') return 'reconnecting';
  if (a === 'live' && b === 'live') return 'live';
  if (a === 'offline' && b === 'offline') return 'offline';
  return a === 'connecting' || b === 'connecting' ? 'connecting' : 'live';
}

export interface UseStatsResult {
  stats: ClerkStats;
  loading: boolean;
  error: string | null;
  status: ConnectionStatus;
  insertCount: number;
  lastInsertAt: number | null;
}

/** Derived from the shared items + failures feeds, so it costs no extra channel and always agrees with the board. */
export function useStats(communityId: string | null | undefined): UseStatsResult {
  const items = useItems(communityId);
  const failures = useFailures(communityId);
  const stats = useMemo(() => computeStats(items.items, failures.failures), [items.items, failures.failures]);
  return {
    stats,
    loading: items.loading || failures.loading,
    error: items.error ?? failures.error,
    status: combineStatus(items.status, failures.status),
    insertCount: items.insertCount + failures.insertCount,
    lastInsertAt: Math.max(items.lastInsertAt ?? 0, failures.lastInsertAt ?? 0) || null,
  };
}
