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
      className="inline-flex rounded-md px-2 py-1 text-[12px] font-medium text-[#7C5CFF] outline-none hover:bg-[#7C5CFF]/15 focus-visible:ring-2 focus-visible:ring-[#7C5CFF]"
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
      className="flex min-h-[12rem] min-w-0 flex-col rounded-2xl border border-white/[0.08] bg-[#141826]/60 backdrop-blur-xl"
    >
      <header className="flex items-center justify-between gap-2 border-b border-white/[0.06] px-3.5 py-3">
        <div className="flex min-w-0 items-center gap-2">
          <span className="h-2 w-2 shrink-0 rounded-full" style={{ background: column.accent }} aria-hidden />
          <h2 id={headingId} className="text-[13px] font-semibold tracking-tight text-[#E8EAF2]">
            {column.title}
          </h2>
          <span className="truncate text-[11px] text-[#8A90A6]">{column.hint}</span>
        </div>
        <span
          className="min-w-[1.5rem] rounded-full bg-white/[0.06] px-1.5 py-0.5 text-center font-mono text-[11px] tabular-nums text-[#E8EAF2]"
          aria-label={`${items.length} ${items.length === 1 ? 'card' : 'cards'}`}
        >
          {items.length}
        </span>
      </header>

      <div className="flex-1 overflow-y-auto p-2.5 lg:max-h-[calc(100vh-17rem)]">
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
                className={hot ? '!border-[#F43F5E]/45' : undefined}
                actions={item.status === 'pending' ? <ReviewLink id={item.id} /> : undefined}
              />
            );
          })}
        </div>
        {items.length === 0 ? (
          <p className="px-2 py-6 text-center text-[12px] leading-5 text-[#8A90A6]">{emptyOverride ?? column.empty}</p>
        ) : null}
      </div>
    </section>
  );
}
