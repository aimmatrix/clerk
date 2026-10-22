'use client';

import { useEffect, useId, useRef, useState } from 'react';
import type { KeyboardEvent, MouseEvent, ReactNode } from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import type { Variants } from 'framer-motion';
import type { Item, ItemStatus } from '@clerk/core';
import { ApproveBurst } from './approve-burst';
import { ConfidenceRing } from './confidence-ring';
import { avatarHue, cx, formatDue, initials } from './format';
import { CARD_SPRING, PRIORITY_COLOURS, TYPE_COLOURS, TYPE_LABELS, URGENT_COLOUR } from './tokens';

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

const SHADOW_REST = '0 0 0 0 rgba(52,211,153,0), 0 8px 24px -12px rgba(0,0,0,0.6)';
const SHADOW_GLOW = '0 0 0 1px rgba(52,211,153,0.55), 0 0 32px 2px rgba(52,211,153,0.35)';

function buildVariants(reduced: boolean): Variants {
  if (reduced) {
    return {
      pending: { opacity: 1, boxShadow: SHADOW_REST, transition: { duration: 0.15 } },
      approved: { opacity: 1, boxShadow: SHADOW_GLOW, transition: { duration: 0.15 } },
      posted: { opacity: 0.75, boxShadow: SHADOW_REST, transition: { duration: 0.15 } },
      rejected: { opacity: 0.4, boxShadow: SHADOW_REST, transition: { duration: 0.15 } },
    };
  }
  return {
    pending: { opacity: 1, scale: 1, y: 0, boxShadow: SHADOW_REST, transition: CARD_SPRING },
    // Scale pulse is a three-keyframe tween (springs only support two keyframes).
    approved: {
      opacity: 1,
      y: 0,
      scale: [1, 1.04, 1],
      boxShadow: SHADOW_GLOW,
      transition: { scale: { duration: 0.5, times: [0, 0.4, 1] }, boxShadow: { duration: 0.4 }, default: CARD_SPRING },
    },
    posted: { opacity: 0.75, scale: 1, y: 0, boxShadow: SHADOW_REST, transition: CARD_SPRING },
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
        className="flex items-center justify-center rounded-full border border-dashed border-white/25 font-mono text-[#8A90A6]"
        style={{ width: size, height: size, fontSize: size * 0.4 }}
      >
        ?
      </span>
    );
  }
  const hue = avatarHue(name);
  return (
    <span
      aria-hidden
      className="flex items-center justify-center rounded-full font-semibold text-white"
      style={{
        width: size,
        height: size,
        fontSize: size * 0.38,
        background: `linear-gradient(135deg, hsl(${hue} 70% 48%), hsl(${(hue + 40) % 360} 70% 38%))`,
      }}
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
  const colour = TYPE_COLOURS[type];
  return (
    <span
      className="inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[11px] font-medium leading-4"
      style={{ color: colour, background: `${colour}1F`, boxShadow: `inset 0 0 0 1px ${colour}40` }}
    >
      <span aria-hidden className="h-1.5 w-1.5 rounded-full" style={{ background: colour }} />
      {TYPE_LABELS[type]}
    </span>
  );
}

function PriorityPill({ priority }: { priority: Item['priority'] }) {
  const colour = PRIORITY_COLOURS[priority];
  return (
    <span
      className="rounded-md px-1.5 py-0.5 font-mono text-[10px] font-semibold leading-4"
      style={{ color: colour, background: `${colour}1F` }}
      title={`Priority ${priority}`}
    >
      {priority}
    </span>
  );
}

const STATE_BADGE: Partial<Record<ItemCardVariant, { text: string; colour: string }>> = {
  approved: { text: 'Approved', colour: '#34D399' },
  posted: { text: 'Posted', colour: '#34D399' },
  rejected: { text: 'Rejected', colour: '#8A90A6' },
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
  const typeColour = TYPE_COLOURS[item.type];
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

  const avatarSize = compact ? 20 : 34;
  const ringSize = compact ? 28 : 44;

  return (
    <motion.article
      layout={!reduced}
      layoutId={reduced ? undefined : sharedId}
      variants={buildVariants(reduced)}
      initial={reduced ? { opacity: 0 } : { opacity: 0, y: 6, scale: 0.97 }}
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
        'group relative rounded-2xl border bg-[#141826]/60 text-[#E8EAF2] backdrop-blur-xl',
        'outline-none focus-visible:ring-2 focus-visible:ring-[#7C5CFF]',
        compact ? 'px-3 py-2' : 'p-3.5',
        selected ? 'border-[#7C5CFF]/70' : urgent ? 'border-[#F43F5E]/40' : 'border-white/[0.08]',
        interactive && 'cursor-pointer',
        className,
      )}
    >
      {/* Type accent bar */}
      <span
        aria-hidden
        className="absolute bottom-3 left-0 top-3 w-[3px] rounded-r-full"
        style={{ background: urgent ? URGENT_COLOUR : typeColour }}
      />

      {bursting && <ApproveBurst onComplete={() => setBursting(false)} />}

      {compact ? (
        <div className="flex items-center gap-2.5 pl-1">
          <ConfidenceRing confidence={item.confidence} size={ringSize} stroke={2.5}>
            <Avatar name={item.ownerName} size={avatarSize} />
          </ConfidenceRing>
          <span aria-hidden className="h-2 w-2 shrink-0 rounded-full" style={{ background: typeColour }} title={TYPE_LABELS[item.type]} />
          <span className="sr-only">{TYPE_LABELS[item.type]}:</span>
          <h3 id={titleId} className={cx('min-w-0 flex-1 truncate text-[13px] font-medium', resolvedVariant === 'rejected' && 'line-through')}>
            {item.title}
          </h3>
          {due && (
            <span
              className="shrink-0 text-[11px] tabular-nums"
              style={{ color: due.overdue ? URGENT_COLOUR : '#8A90A6' }}
              suppressHydrationWarning
            >
              {due.text}
            </span>
          )}
          <PriorityPill priority={item.priority} />
        </div>
      ) : (
        <div className="flex gap-3 pl-1.5">
          <div className="flex flex-col items-center gap-1">
            <ConfidenceRing confidence={item.confidence} size={ringSize} stroke={3}>
              <Avatar name={item.ownerName} size={avatarSize} />
            </ConfidenceRing>
            <span className="font-mono text-[10px] tabular-nums text-[#8A90A6]" title="Extraction confidence">
              {Math.round(item.confidence * 100)}%
            </span>
          </div>

          <div className="min-w-0 flex-1">
            <div className="mb-1.5 flex flex-wrap items-center gap-1.5">
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
              className={cx('font-display text-[15px] font-semibold leading-5', resolvedVariant === 'rejected' && 'line-through decoration-white/30')}
            >
              {item.title}
            </h3>

            {item.summary && <p className="mt-1 line-clamp-2 text-[13px] leading-[18px] text-[#8A90A6]">{item.summary}</p>}

            {item.type === 'question' && item.suggestedReply && (
              <p className="mt-2 line-clamp-2 rounded-lg bg-[#60A5FA]/10 px-2.5 py-1.5 text-[12px] leading-[17px] text-[#B7D3FB]">
                <span aria-hidden>💬 </span>
                <span className="sr-only">Suggested reply: </span>
                {item.suggestedReply}
              </p>
            )}

            <div className="mt-2.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-[12px] text-[#8A90A6]">
              <span className={cx('truncate', !item.ownerName && 'italic')}>{item.ownerName ?? 'Unassigned'}</span>
              {due && (
                <span
                  className="tabular-nums"
                  style={{ color: due.overdue ? URGENT_COLOUR : due.soon ? '#F59E0B' : undefined }}
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
                  className="ml-auto inline-flex items-center gap-1 rounded text-[#22D3EE] hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#22D3EE]"
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
