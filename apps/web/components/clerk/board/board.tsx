'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import type { Item } from '@clerk/core';
import { LayoutGroup } from 'framer-motion';
import { BoardEmptyState, BoardSkeleton } from './board-empty-state';
import { BoardColumn } from './board-column';
import { COLUMNS, countByType, groupByColumn, isBoardVisible, type TypeFilter } from './columns';
import { FilterChips } from './filter-chips';
import { cx } from './format';
import { LiveBadge } from './live-badge';
import { TYPE_LABELS } from '@/components/clerk/card';
import { useMockItems } from './mock-hook';
import type { BoardItemsResult } from './types';
import { useBoardItems } from './use-board-items';

export interface BoardProps {
  communityId: string;
  /**
   * Controlled mode: render these items and do not subscribe to anything. The simulator (C7) can use this
   * to drive the board from its own client-side state when realtime is unavailable.
   */
  items?: Item[];
  /** Demo mode: ignore the live feed and promote fixture cards through the columns on a timer. */
  autoplay?: boolean;
  /** Hide the page heading and live badge (for embedding in the simulator split screen). */
  hideHeader?: boolean;
  /** Drop card summaries and tighten spacing. */
  compact?: boolean;
  className?: string;
}

function useNow(intervalMs = 60_000): Date | null {
  const [now, setNow] = useState<Date | null>(null);
  useEffect(() => {
    setNow(new Date());
    const timer = setInterval(() => setNow(new Date()), intervalMs);
    return () => clearInterval(timer);
  }, [intervalMs]);
  return now;
}

/** Counts new ids appearing after the first load so the Live badge can pulse once per insert. */
function useInsertPulse(items: readonly Item[], loading: boolean): number {
  const seen = useRef<Set<string> | null>(null);
  const [pulse, setPulse] = useState(0);

  useEffect(() => {
    if (loading) return;
    const ids = new Set(items.map((i) => i.id));
    if (seen.current === null) {
      seen.current = ids;
      return;
    }
    let added = 0;
    ids.forEach((id) => {
      if (!seen.current?.has(id)) added += 1;
    });
    seen.current = ids;
    if (added > 0) setPulse((p) => p + 1);
  }, [items, loading]);

  return pulse;
}

export interface BoardViewProps {
  items: Item[];
  loading?: boolean;
  error?: string | null;
  /** Realtime connection state, shown on the Live badge. */
  status?: BoardItemsResult['status'];
  /** From the realtime feed. When omitted the board counts newly seen ids itself. */
  insertCount?: number;
  hideHeader?: boolean;
  compact?: boolean;
  className?: string;
}

/** Presentational board: filters, columns, empty and error states. Data-source agnostic. */
export function BoardView({
  items,
  loading = false,
  error = null,
  status,
  insertCount,
  hideHeader,
  compact,
  className,
}: BoardViewProps) {
  const [filter, setFilter] = useState<TypeFilter>('all');
  const now = useNow();
  const detectedInserts = useInsertPulse(items, loading);
  const pulseKey = insertCount ?? detectedInserts;

  const counts = useMemo(() => countByType(items), [items]);
  const grouped = useMemo(() => groupByColumn(items, filter), [items, filter]);

  // One message can yield several cards, so only a lone card may claim the shared `msg-<id>` layout id.
  const layoutIds = useMemo(() => {
    const perMessage = new Map<string, number>();
    const visible = items.filter(isBoardVisible);
    for (const item of visible) perMessage.set(item.messageId, (perMessage.get(item.messageId) ?? 0) + 1);
    const ids = new Map<string, string>();
    for (const item of visible) {
      ids.set(item.id, perMessage.get(item.messageId) === 1 ? `msg-${item.messageId}` : `item-${item.id}`);
    }
    return ids;
  }, [items]);

  const isEmpty = !loading && counts.all === 0;
  const emptyOverride = filter === 'all' ? undefined : `No ${TYPE_LABELS[filter].toLowerCase()} cards here.`;

  return (
    <div className={cx('flex flex-col gap-6', className)}>
      {hideHeader ? null : (
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h1 className="page-heading">Board</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Everything Clerk captured, most urgent first. Nothing is posted without your approval.
            </p>
          </div>
          <LiveBadge pulseKey={pulseKey} status={status} />
        </div>
      )}

      {error ? (
        <div
          role="alert"
          className="rounded-xl border border-urgent/30 bg-surface px-4 py-3 text-sm text-foreground"
        >
          Couldn&rsquo;t reach the live feed.
          {items.length > 0 ? ' Showing the last known state.' : ''} ({error})
        </div>
      ) : null}

      {loading ? (
        <BoardSkeleton />
      ) : isEmpty ? (
        <BoardEmptyState />
      ) : (
        <>
          <FilterChips value={filter} counts={counts} onChange={setFilter} />
          <LayoutGroup id="clerk-board">
            <div className="grid gap-5 border-t border-border pt-6 md:grid-cols-2 xl:grid-cols-4">
              {COLUMNS.map((column) => (
                <BoardColumn
                  key={column.id}
                  column={column}
                  items={grouped[column.id]}
                  layoutIds={layoutIds}
                  now={now}
                  compact={compact}
                  emptyOverride={emptyOverride}
                />
              ))}
            </div>
          </LayoutGroup>
        </>
      )}
    </div>
  );
}

function LiveBoard({ communityId, autoplay: _autoplay, ...rest }: Omit<BoardProps, 'items'>) {
  const { items, loading, error, status, insertCount } = useBoardItems(communityId);
  return <BoardView items={items} loading={loading} error={error} status={status} insertCount={insertCount} {...rest} />;
}

function DemoBoard({ communityId, autoplay: _autoplay, ...rest }: Omit<BoardProps, 'items'>) {
  const { items, loading, error } = useMockItems(communityId, { autoplay: true });
  return <BoardView items={items} loading={loading} error={error} {...rest} />;
}

/**
 * The live Kanban board. Pass `items` to control it (simulator), `autoplay` for the offline demo,
 * otherwise it subscribes to the realtime feed for `communityId`.
 */
export function Board({ items, ...rest }: BoardProps) {
  if (items) {
    const { communityId: _communityId, autoplay: _autoplay, ...view } = rest;
    return <BoardView items={items} {...view} />;
  }
  return rest.autoplay ? <DemoBoard {...rest} /> : <LiveBoard {...rest} />;
}
