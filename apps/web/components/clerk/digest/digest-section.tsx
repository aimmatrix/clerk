'use client';

import type { ReactNode } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import type { Item, ItemType } from '@clerk/core';
import { formatDue, initials } from './format';

export type SectionTone = 'urgent' | 'primary' | 'question' | 'decision';

const TONES: Record<SectionTone, { text: string; dot: string; ring: string }> = {
  urgent: { text: 'text-[#F43F5E]', dot: 'bg-[#F43F5E]', ring: 'border-[#F43F5E]/30' },
  primary: { text: 'text-[#B3A1FF]', dot: 'bg-[#7C5CFF]', ring: 'border-white/10' },
  question: { text: 'text-[#60A5FA]', dot: 'bg-[#60A5FA]', ring: 'border-white/10' },
  decision: { text: 'text-[#34D399]', dot: 'bg-[#34D399]', ring: 'border-white/10' },
};

const TYPE_COLOUR: Record<ItemType, string> = {
  request: '#F59E0B',
  task: '#7C5CFF',
  event: '#22D3EE',
  question: '#60A5FA',
  decision: '#34D399',
  noise: '#4B5163',
};

const PRIORITY_COLOUR: Record<Item['priority'], string> = {
  P0: 'bg-[#F43F5E]/15 text-[#FB7185] border-[#F43F5E]/40',
  P1: 'bg-[#F59E0B]/15 text-[#FBBF24] border-[#F59E0B]/40',
  P2: 'bg-white/5 text-[#C5C9D8] border-white/15',
  P3: 'bg-white/5 text-[#8A90A6] border-white/10',
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
    <section
      aria-labelledby={id}
      className={`rounded-2xl border ${t.ring} bg-[#141826]/60 p-5 backdrop-blur-xl`}
    >
      <header className="mb-4 flex items-baseline gap-3">
        <span aria-hidden className={`size-2 shrink-0 translate-y-[-1px] rounded-full ${t.dot}`} />
        <h2 id={id} className={`text-lg font-semibold tracking-tight ${t.text}`}>
          {title}
        </h2>
        <span className="rounded-full bg-white/5 px-2 py-0.5 font-mono text-xs tabular-nums text-[#8A90A6]">
          {count}
        </span>
        {hint ? <span className="ml-auto hidden text-xs text-[#8A90A6] sm:inline">{hint}</span> : null}
      </header>
      {children}
    </section>
  );
}

export function EmptyNote({ children }: { children: ReactNode }) {
  return <p className="rounded-lg border border-dashed border-white/10 px-4 py-3 text-sm text-[#8A90A6]">{children}</p>;
}

export function OwnerAvatar({ name, size = 'md' }: { name: string | null; size?: 'sm' | 'md' }) {
  const dim = size === 'sm' ? 'size-6 text-[10px]' : 'size-8 text-xs';
  if (!name) {
    return (
      <span
        aria-hidden
        className={`${dim} inline-flex shrink-0 items-center justify-center rounded-full border border-dashed border-white/20 text-[#8A90A6]`}
      >
        ?
      </span>
    );
  }
  return (
    <span
      aria-hidden
      className={`${dim} inline-flex shrink-0 items-center justify-center rounded-full bg-[#7C5CFF]/25 font-semibold text-[#D4CBFF]`}
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
      className="flex items-start gap-3 rounded-xl border border-white/5 bg-white/[0.03] px-3 py-2.5"
    >
      {showOwner ? <OwnerAvatar name={item.ownerName} /> : null}
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
          <span
            className="rounded-md px-1.5 py-0.5 text-[11px] font-medium uppercase tracking-wide"
            style={{ color: TYPE_COLOUR[item.type], backgroundColor: `${TYPE_COLOUR[item.type]}1F` }}
          >
            {item.type}
          </span>
          <span
            className={`rounded-md border px-1.5 py-0.5 font-mono text-[11px] ${PRIORITY_COLOUR[item.priority]}`}
            title={`Priority ${item.priority}`}
          >
            {item.priority}
          </span>
          <p className="text-sm font-medium text-[#E8EAF2]">{item.title}</p>
        </div>

        <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs text-[#8A90A6]">
          {showOwner ? <span>{item.ownerName ?? 'Unassigned'}</span> : null}
          {due ? (
            <span className={due.overdue ? 'font-medium text-[#F43F5E]' : undefined}>{due.label}</span>
          ) : null}
          {item.sourceLink ? (
            <a
              href={item.sourceLink}
              target="_blank"
              rel="noopener noreferrer"
              className="rounded text-[#7C5CFF] underline-offset-2 hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#7C5CFF]"
            >
              Source<span className="sr-only"> message for {item.title} (opens in a new tab)</span>
            </a>
          ) : null}
        </div>

        {showReply && item.suggestedReply ? (
          <blockquote className="mt-2 border-l-2 border-[#60A5FA]/50 pl-3 text-xs italic text-[#A9B0C6]">
            <span className="not-italic text-[#60A5FA]">Drafted reply: </span>
            {item.suggestedReply}
          </blockquote>
        ) : null}
      </div>
    </motion.li>
  );
}

export function ItemList({ children }: { children: ReactNode }) {
  return (
    <ul className="space-y-2">
      <AnimatePresence initial={false}>{children}</AnimatePresence>
    </ul>
  );
}
