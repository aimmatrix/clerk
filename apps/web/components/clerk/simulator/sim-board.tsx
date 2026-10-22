'use client';

import type { ItemStatus, ItemType } from '@clerk/core';
import { AnimatePresence, LayoutGroup } from 'framer-motion';
import Link from 'next/link';
import { useMemo, useState } from 'react';
import { FAILURE_LABEL, TYPE_META, clock } from './format';
import type { SimFailure, SimItem } from './pipeline';
import { SimCard } from './sim-card';
import type { ReviewStep } from './use-simulator';

/**
 * Local stand-in for C3's `Board`. It renders the simulator's own client-side state, which is
 * also the brief's fallback if Supabase realtime is unavailable. Swap for C3's `Board` once
 * merged; props are plain data so the swap is mechanical.
 */

const COLUMNS: { status: ItemStatus; title: string; empty: string }[] = [
  { status: 'pending', title: 'Inbox', empty: 'Nothing waiting. Press Play.' },
  { status: 'approved', title: 'Approved', empty: 'Approve a card to see it here.' },
  { status: 'posted', title: 'Posted', empty: 'Nothing posted (simulated).' },
  { status: 'done', title: 'Done', empty: 'Nothing finished yet.' },
];

const FILTERABLE: Exclude<ItemType, 'noise'>[] = ['request', 'task', 'event', 'question', 'decision'];

interface SimBoardProps {
  items: SimItem[];
  failures: SimFailure[];
  onReview: (id: string, step: ReviewStep) => void;
}

export function SimBoard({ items, failures, onReview }: SimBoardProps) {
  const [filter, setFilter] = useState<ItemType | null>(null);

  const counts = useMemo(() => {
    const c = new Map<ItemType, number>();
    items.forEach((i) => c.set(i.type, (c.get(i.type) ?? 0) + 1));
    return c;
  }, [items]);

  const visible = useMemo(
    () => items.filter((i) => i.status !== 'rejected' && (filter === null || i.type === filter)),
    [items, filter],
  );

  return (
    <section aria-label="Live board" className="panel flex min-h-0 flex-col overflow-hidden">
      <header className="flex flex-wrap items-center justify-between gap-2 border-b border-border px-5 py-3">
        <h2 className="text-sm font-semibold">Queue</h2>
        <div role="group" aria-label="Filter by type" className="flex flex-wrap gap-1.5">
          <button
            type="button"
            aria-pressed={filter === null}
            onClick={() => setFilter(null)}
            className={`rounded-full px-2.5 py-1 text-[11px] transition ${
              filter === null ? 'bg-foreground text-background' : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            All {items.filter((i) => i.status !== 'rejected').length}
          </button>
          {FILTERABLE.filter((t) => (counts.get(t) ?? 0) > 0).map((t) => (
            <button
              key={t}
              type="button"
              aria-pressed={filter === t}
              onClick={() => setFilter(filter === t ? null : t)}
              className={`rounded-full px-2.5 py-1 text-[11px] transition ${
                filter === t ? 'bg-foreground text-background' : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              {TYPE_META[t].label} {counts.get(t)}
            </button>
          ))}
        </div>
      </header>

      <LayoutGroup id="sim-board">
        <div className="grid min-h-0 flex-1 grid-cols-1 gap-3 overflow-y-auto p-3 sm:grid-cols-2 xl:grid-cols-4 xl:overflow-hidden">
          {COLUMNS.map((col) => {
            const cards = visible
              .filter((i) => i.status === col.status)
              .sort((a, b) => b.urgencyScore - a.urgencyScore);
            return (
              <div key={col.status} className="flex min-h-0 min-w-0 flex-col">
                <div className="mb-2 flex items-center justify-between px-1">
                  <h3 className="text-[13px] font-semibold text-foreground">{col.title}</h3>
                  <span className="font-mono text-[11px] text-subtle tabular-nums">{cards.length}</span>
                </div>
                <div
                  data-sim-column={col.status}
                  className="flex min-h-40 flex-1 flex-col gap-2 overflow-y-auto xl:min-h-0"
                >
                  <AnimatePresence initial={false}>
                    {cards.map((item) => (
                      <SimCard key={item.id} item={item} onReview={onReview} />
                    ))}
                  </AnimatePresence>
                  {cards.length === 0 && (
                    <p className="m-auto px-2 py-6 text-center text-xs text-subtle">{col.empty}</p>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </LayoutGroup>

      <footer className="border-t border-border px-5 py-3">
        <div className="flex items-center justify-between gap-2">
          <h3 className="text-xs font-semibold text-foreground">
            Couldn&apos;t handle <span className="font-mono">({failures.length})</span>
          </h3>
          <Link href="/failures" className="text-xs text-muted-foreground underline-offset-2 hover:text-foreground hover:underline">
            Open full log
          </Link>
        </div>
        {failures.length === 0 ? (
          <p className="mt-1 text-xs text-subtle">
            Anything Clerk can&apos;t confidently read lands here instead of being guessed at.
          </p>
        ) : (
          <ul className="mt-1.5 space-y-1">
            {failures.slice(-3).map((f) => (
              <li key={f.id} className="flex items-center gap-2 text-xs">
                <span className="font-mono text-[11px] text-muted-foreground">
                  {FAILURE_LABEL[f.reason]}
                  {f.confidence !== null && ` · ${Math.round(f.confidence * 100)}%`}
                </span>
                <span className="min-w-0 flex-1 truncate text-muted-foreground">
                  {f.authorName}: “{f.messageContent}”
                </span>
                <time className="font-mono text-[11px] text-subtle">{clock(f.createdAt)}</time>
              </li>
            ))}
          </ul>
        )}
        <p className="mt-2 text-[11px] text-subtle">
          Simulated: approving and posting here never sends anything to Discord.
        </p>
      </footer>
    </section>
  );
}
