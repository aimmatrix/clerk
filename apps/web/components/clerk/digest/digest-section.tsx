'use client';

import type { ReactNode } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import type { Item } from '@clerk/core';
import { formatDue, initials } from './format';

export type SectionTone = 'urgent' | 'primary' | 'question' | 'decision';

const TONES: Record<SectionTone, { text: string }> = {
  urgent: { text: 'text-urgent' },
  primary: { text: 'text-foreground' },
  question: { text: 'text-foreground' },
  decision: { text: 'text-foreground' },
};

const PRIORITY_COLOUR: Record<Item['priority'], string> = {
  P0: 'font-semibold text-urgent',
  P1: 'font-medium text-foreground',
  P2: 'text-muted-foreground',
  P3: 'text-subtle',
};

export function DigestSection({
  id,
  title,
  count,
  tone,
  hint,
  children,
}: {
  id: string;
  title: string;
  count: number;
  tone: SectionTone;
  hint?: string;
  children: ReactNode;
}) {
  const t = TONES[tone];
  return (
    <section aria-labelledby={id}>
      <header className="flex items-baseline justify-between gap-3 border-b border-foreground pb-2.5">
        <h2 id={id} className={`text-[13px] font-semibold ${t.text}`}>
          {title}
        </h2>
        <span className="flex items-baseline gap-3 text-xs text-subtle">
          {hint ? <span className="hidden sm:inline">{hint}</span> : null}
          <span className="font-mono tabular-nums">{count}</span>
        </span>
      </header>
      {children}
    </section>
  );
}

export function EmptyNote({ children }: { children: ReactNode }) {
  return <p className="mt-4 rounded-lg border border-dashed border-input px-4 py-3 text-sm text-subtle">{children}</p>;
}

export function OwnerAvatar({ name, size = 'md' }: { name: string | null; size?: 'sm' | 'md' }) {
  const dim = size === 'sm' ? 'size-6 text-[10px]' : 'size-8 text-xs';
  if (!name) {
    return (
      <span
        aria-hidden
        className={`${dim} inline-flex shrink-0 items-center justify-center rounded-full border border-dashed border-input text-subtle`}
      >
        ?
      </span>
    );
  }
  return (
    <span
      aria-hidden
      className={`${dim} inline-flex shrink-0 items-center justify-center rounded-full bg-sunken font-semibold text-muted-foreground`}
    >
      {initials(name)}
    </span>
  );
}

export function ItemRow({
  item,
  now,
  showOwner = false,
  showReply = false,
}: {
  item: Item;
  now: Date;
  showOwner?: boolean;
  showReply?: boolean;
}) {
  const reduce = useReducedMotion();
  const due = formatDue(item.dueAt, now);

  return (
    <motion.li
      layout={!reduce}
      initial={reduce ? { opacity: 0 } : { opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0 }}
      transition={{ type: 'spring', stiffness: 260, damping: 24 }}
      className="flex items-start gap-3 border-b border-border py-3.5"
    >
      {showOwner ? <OwnerAvatar name={item.ownerName} /> : null}
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
          <span className="font-mono text-[11px] uppercase tracking-[0.05em] text-subtle">{item.type}</span>
          <span className={`font-mono text-[11px] ${PRIORITY_COLOUR[item.priority]}`} title={`Priority ${item.priority}`}>
            {item.priority}
          </span>
          <p className="text-[15px] text-foreground">{item.title}</p>
        </div>

        <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-[13px] text-subtle">
          {showOwner ? <span>{item.ownerName ?? 'Unassigned'}</span> : null}
          {due ? (
            <span className={due.overdue ? 'font-medium text-urgent' : undefined}>{due.label}</span>
          ) : null}
          {item.sourceLink ? (
            <a
              href={item.sourceLink}
              target="_blank"
              rel="noopener noreferrer"
              className="rounded text-primary underline-offset-2 hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary"
            >
              Source<span className="sr-only"> message for {item.title} (opens in a new tab)</span>
            </a>
          ) : null}
        </div>

        {showReply && item.suggestedReply ? (
          <blockquote className="mt-2 border-l-2 border-input pl-3 text-[13px] text-muted-foreground">
            <span className="text-subtle">Draft: </span>
            {item.suggestedReply}
          </blockquote>
        ) : null}
      </div>
    </motion.li>
  );
}

export function ItemList({ children }: { children: ReactNode }) {
  return (
    <ul>
      <AnimatePresence initial={false}>{children}</AnimatePresence>
    </ul>
  );
}
