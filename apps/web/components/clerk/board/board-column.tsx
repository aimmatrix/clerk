'use client';

import type { Item } from '@clerk/core';
import { ItemCard, formatDue } from '@/components/clerk/card';
import type { ColumnDef } from './columns';

export interface BoardColumnProps {
  column: ColumnDef;
  items: Item[];
  /** Layout id per item id, computed by the board so ids stay unique across columns. */
  layoutIds: Map<string, string>;
  /** Null until mounted: relative dates are client-only to avoid hydration mismatches. */
  now: Date | null;
  compact?: boolean;
  /** Replaces the column's default empty copy, e.g. when a type filter hides everything. */
  emptyOverride?: string;
}

/** Urgency score at or above which a card is drawn as hot. */
const HOT_SCORE = 80;

function ReviewLink({ id }: { id: string }) {
  return (
    <a
      href={`/review?focus=${encodeURIComponent(id)}`}
      className="inline-flex rounded-md px-2 py-1 text-[12px] font-medium text-primary outline-none hover:bg-sunken focus-visible:ring-2 focus-visible:ring-primary"
    >
      Review
    </a>
  );
}

export function BoardColumn({ column, items, layoutIds, now, compact, emptyOverride }: BoardColumnProps) {
  const headingId = `board-column-${column.id}`;

  return (
    <section
      aria-labelledby={headingId}
      data-column={column.id}
      className="flex min-w-0 flex-col"
    >
      <header className="flex items-baseline justify-between gap-2 px-0.5 pb-3">
        <h2 id={headingId} className="text-sm font-semibold text-foreground">
          {column.title}
          <span
            className="ml-1.5 font-mono text-xs font-normal tabular-nums text-subtle"
            aria-label={`${items.length} ${items.length === 1 ? 'card' : 'cards'}`}
          >
            {items.length}
          </span>
        </h2>
        <span className="truncate text-xs text-subtle">{column.hint}</span>
      </header>

      <div className="flex-1 lg:max-h-[calc(100vh-17rem)] lg:overflow-y-auto">
        <div className="flex flex-col gap-2.5" role="group" aria-label={`${column.title} cards`}>
          {/*
            No AnimatePresence on purpose. Cards travel between columns via their shared layoutId, which needs no
            presence tracking, and wrapping them leaves exiting copies stranded in the old column (opacity 0, never
            unmounted). The cost: cards removed outright (filter change, rejection) disappear without an exit fade.
          */}
          {items.map((item) => {
            const hot =
              item.status !== 'done' &&
              (item.urgencyScore >= HOT_SCORE || Boolean(now && formatDue(item.dueAt, now)?.overdue));
            return (
              <ItemCard
                key={item.id}
                item={item}
                layoutId={layoutIds.get(item.id) ?? `item-${item.id}`}
                now={now ?? undefined}
                compact={compact}
                burstOnApprove={false}
                className={hot ? '!border-urgent/50' : undefined}
                actions={item.status === 'pending' ? <ReviewLink id={item.id} /> : undefined}
              />
            );
          })}
        </div>
        {items.length === 0 ? (
          <p className="rounded-[10px] border border-dashed border-input px-4 py-5 text-center text-[13px] leading-5 text-subtle">{emptyOverride ?? column.empty}</p>
        ) : null}
      </div>
    </section>
  );
}
