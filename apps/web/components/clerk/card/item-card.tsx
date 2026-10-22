'use client';

import { useEffect, useId, useRef, useState } from 'react';
import type { KeyboardEvent, MouseEvent, ReactNode } from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import type { Variants } from 'framer-motion';
import type { Item, ItemStatus } from '@clerk/core';
import { ApproveBurst } from './approve-burst';
import { ConfidenceRing } from './confidence-ring';
import { cx, formatDue, initials } from './format';
import { CARD_SPRING, PRIORITY_COLOURS, TYPE_LABELS, URGENT_COLOUR } from './tokens';

export type ItemCardVariant = 'pending' | 'approved' | 'posted' | 'rejected';

/** Shared layout id so a card can spring out of the chat message it came from (C7 uses the same helper). */
export function messageLayoutId(messageId: string): string {
  return `msg-${messageId}`;
}

function variantFromStatus(status: ItemStatus): ItemCardVariant {
  switch (status) {
    case 'approved':
      return 'approved';
    case 'posted':
    case 'done':
      return 'posted';
    case 'rejected':
      return 'rejected';
    default:
      return 'pending';
  }
}

const SHADOW_REST = '0 0 0 0 rgba(21,128,61,0)';
const SHADOW_GLOW = '0 0 0 1px rgba(21,128,61,0.5)';

function buildVariants(reduced: boolean): Variants {
  if (reduced) {
    return {
      pending: { opacity: 1, boxShadow: SHADOW_REST, transition: { duration: 0.15 } },
      approved: { opacity: 1, boxShadow: SHADOW_GLOW, transition: { duration: 0.15 } },
      posted: { opacity: 0.8, boxShadow: SHADOW_REST, transition: { duration: 0.15 } },
      rejected: { opacity: 0.4, boxShadow: SHADOW_REST, transition: { duration: 0.15 } },
    };
  }
  return {
    pending: { opacity: 1, scale: 1, y: 0, boxShadow: SHADOW_REST, transition: CARD_SPRING },
    approved: {
      opacity: 1,
      y: 0,
      boxShadow: SHADOW_GLOW,
      transition: { boxShadow: { duration: 0.3 }, default: CARD_SPRING },
    },
    posted: { opacity: 0.8, scale: 1, y: 0, boxShadow: SHADOW_REST, transition: CARD_SPRING },
    rejected: { opacity: 0.4, scale: 0.98, y: 8, boxShadow: SHADOW_REST, transition: { duration: 0.3 } },
  };
}

export interface ItemCardProps {
  item: Item;
  /** Visual state. Defaults to the one implied by `item.status`. */
  variant?: ItemCardVariant;
  compact?: boolean;
  /** Defaults to `msg-<messageId>`. Pass `false` to opt out of shared-layout animation (e.g. several cards per message). */
  layoutId?: string | false;
  selected?: boolean;
  /** Fire the particle burst when the card becomes approved. Default true. */
  burstOnApprove?: boolean;
  /** Override "now" for relative due dates (tests, stories, SSR). */
  now?: Date;
  onSelect?: (item: Item) => void;
  /** Optional slot rendered at the bottom of the full card (e.g. review buttons). */
  actions?: ReactNode;
  className?: string;
}

function Avatar({ name, size }: { name: string | null; size: number }) {
  if (!name) {
    return (
      <span
        aria-hidden
        className="flex items-center justify-center rounded-full border border-dashed border-input font-mono text-subtle"
        style={{ width: size, height: size, fontSize: size * 0.4 }}
      >
        ?
      </span>
    );
  }
  return (
    <span
      aria-hidden
      className="flex items-center justify-center rounded-full bg-sunken font-semibold text-muted-foreground"
      style={{ width: size, height: size, fontSize: size * 0.38 }}
    >
      {initials(name)}
    </span>
  );
}

function ExternalIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M7 17 17 7M8 7h9v9" />
    </svg>
  );
}

function TypeChip({ type }: { type: Item['type'] }) {
  return (
    <span className="font-mono text-[11px] uppercase leading-4 tracking-[0.05em] text-muted-foreground">
      {TYPE_LABELS[type]}
    </span>
  );
}

function PriorityPill({ priority }: { priority: Item['priority'] }) {
  return (
    <span
      className={cx('font-mono text-[11px] leading-4', priority === 'P0' ? 'font-semibold' : 'font-medium')}
      style={{ color: PRIORITY_COLOURS[priority] }}
      title={`Priority ${priority}`}
    >
      {priority}
    </span>
  );
}

const STATE_BADGE: Partial<Record<ItemCardVariant, { text: string; colour: string }>> = {
  approved: { text: 'Approved', colour: '#15803D' },
  posted: { text: 'Posted', colour: '#15803D' },
  rejected: { text: 'Rejected', colour: '#71717A' },
};

export function ItemCard({
  item,
  variant,
  compact = false,
  layoutId,
  selected = false,
  burstOnApprove = true,
  now,
  onSelect,
  actions,
  className,
}: ItemCardProps) {
  const reduced = useReducedMotion() ?? false;
  const titleId = useId();
  const resolvedVariant = variant ?? variantFromStatus(item.status);
  const sharedId = layoutId === false ? undefined : (layoutId ?? messageLayoutId(item.messageId));

  // Burst only on a transition into "approved", never on first mount of an already-approved card.
  const previous = useRef<ItemCardVariant>(resolvedVariant);
  const [bursting, setBursting] = useState(false);
  useEffect(() => {
    if (burstOnApprove && previous.current !== 'approved' && resolvedVariant === 'approved') setBursting(true);
    previous.current = resolvedVariant;
  }, [resolvedVariant, burstOnApprove]);

  const due = formatDue(item.dueAt, now);
    const urgent = item.priority === 'P0' && resolvedVariant === 'pending';
  const badge = STATE_BADGE[resolvedVariant];
  const interactive = Boolean(onSelect);

  const handleClick = () => onSelect?.(item);
  const handleKey = (event: KeyboardEvent<HTMLElement>) => {
    if (!onSelect || event.target !== event.currentTarget) return;
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      onSelect(item);
    }
  };
  const stopPropagation = (event: MouseEvent) => event.stopPropagation();

  const avatarSize = compact ? 20 : 26;
  const ringSize = compact ? 28 : 34;

  return (
    <motion.article
      layout={!reduced}
      layoutId={reduced ? undefined : sharedId}
      variants={buildVariants(reduced)}
      initial={reduced ? { opacity: 0 } : { opacity: 0, y: 6 }}
      animate={resolvedVariant}
      exit={reduced ? { opacity: 0 } : { opacity: 0, y: 8, transition: { duration: 0.2 } }}
      aria-labelledby={titleId}
      data-item-id={item.id}
      data-type={item.type}
      data-variant={resolvedVariant}
      data-selected={selected || undefined}
      tabIndex={interactive ? 0 : undefined}
      onClick={interactive ? handleClick : undefined}
      onKeyDown={interactive ? handleKey : undefined}
      className={cx(
        'group relative rounded-[10px] border bg-surface text-foreground',
        'outline-none focus-visible:ring-2 focus-visible:ring-primary',
        compact ? 'px-3 py-2' : 'px-4 py-3.5',
        selected ? 'border-foreground' : 'border-border',
        interactive && 'cursor-pointer',
        className,
      )}
    >
      {bursting && <ApproveBurst onComplete={() => setBursting(false)} />}

      {compact ? (
        <div className="flex items-center gap-2.5">
          <ConfidenceRing confidence={item.confidence} size={ringSize} stroke={2.5}>
            <Avatar name={item.ownerName} size={avatarSize} />
          </ConfidenceRing>
          <span className="sr-only">{TYPE_LABELS[item.type]}:</span>
          <h3 id={titleId} className={cx('min-w-0 flex-1 truncate text-[13px] font-medium', resolvedVariant === 'rejected' && 'line-through')}>
            {item.title}
          </h3>
          {due && (
            <span
              className="shrink-0 text-[11px] tabular-nums"
              style={{ color: due.overdue ? URGENT_COLOUR : '#71717A' }}
              suppressHydrationWarning
            >
              {due.text}
            </span>
          )}
          <PriorityPill priority={item.priority} />
        </div>
      ) : (
        <div className="flex gap-3">
          <div className="flex flex-col items-center gap-1">
            <ConfidenceRing confidence={item.confidence} size={ringSize} stroke={3}>
              <Avatar name={item.ownerName} size={avatarSize} />
            </ConfidenceRing>
            <span className="font-mono text-[10px] tabular-nums text-subtle" title="Extraction confidence">
              {Math.round(item.confidence * 100)}%
            </span>
          </div>

          <div className="min-w-0 flex-1">
            <div className="mb-1.5 flex flex-wrap items-center gap-2">
              <TypeChip type={item.type} />
              <PriorityPill priority={item.priority} />
              {badge && (
                <span className="ml-auto flex items-center gap-1 text-[11px] font-medium" style={{ color: badge.colour }}>
                  {resolvedVariant !== 'rejected' && (
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                      <path d="m5 12 5 5L20 7" />
                    </svg>
                  )}
                  {badge.text}
                </span>
              )}
            </div>

            <h3
              id={titleId}
              className={cx('text-[14px] font-medium leading-5', resolvedVariant === 'rejected' && 'line-through decoration-subtle')}
            >
              {item.title}
            </h3>

            {item.summary && <p className="mt-1 line-clamp-2 text-[13px] leading-[18px] text-muted-foreground">{item.summary}</p>}

            {item.type === 'question' && item.suggestedReply && (
              <p className="mt-2 line-clamp-2 rounded-lg bg-background px-2.5 py-1.5 text-[12px] leading-[17px] text-muted-foreground">
                <span className="text-subtle">Draft reply: </span>
                {item.suggestedReply}
              </p>
            )}

            <div className="mt-2.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-[12px] text-subtle">
              <span className={cx('truncate', !item.ownerName && 'italic')}>{item.ownerName ?? 'Unassigned'}</span>
              {due && (
                <span
                  className="tabular-nums"
                  style={{ color: due.overdue ? URGENT_COLOUR : undefined }}
                  suppressHydrationWarning
                >
                  {due.text}
                </span>
              )}
              {item.sourceLink && (
                <a
                  href={item.sourceLink}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={stopPropagation}
                  className="ml-auto inline-flex items-center gap-1 rounded text-primary hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                  aria-label={`Open source message for ${item.title}`}
                >
                  Source <ExternalIcon />
                </a>
              )}
            </div>

            {actions && (
              <div className="mt-3" onClick={stopPropagation}>
                {actions}
              </div>
            )}
          </div>
        </div>
      )}
    </motion.article>
  );
}
