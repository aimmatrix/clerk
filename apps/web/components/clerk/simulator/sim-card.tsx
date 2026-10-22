'use client';

import { canExportIcs, toIcs } from '@clerk/core';
import { motion, useReducedMotion } from 'framer-motion';
import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { useFlightLauncher } from './flight-layer';
import { PRIORITY_CLASS, TYPE_META, avatarColour, dueLabel, initials, postBackText } from './format';
import type { SimItem } from './pipeline';
import type { ReviewStep } from './use-simulator';

/** Green ≥ 0.8, amber 0.6–0.8, red < 0.6 (matches the brief). */
function ringColour(confidence: number): string {
  if (confidence >= 0.8) return 'rgb(var(--success))';
  if (confidence >= 0.6) return 'rgb(var(--request))';
  return 'rgb(var(--urgent))';
}

function Ring({ confidence }: { confidence: number }) {
  const reduce = useReducedMotion();
  return (
    <span
      className="relative inline-flex h-7 w-7 shrink-0 items-center justify-center"
      title={`Confidence ${(confidence * 100).toFixed(0)}%`}
    >
      <svg viewBox="0 0 28 28" className="absolute inset-0 -rotate-90" aria-hidden>
        <circle cx="14" cy="14" r="11" fill="none" stroke="rgb(255 255 255 / 0.1)" strokeWidth="2.5" />
        <motion.circle
          cx="14"
          cy="14"
          r="11"
          fill="none"
          stroke={ringColour(confidence)}
          strokeWidth="2.5"
          strokeLinecap="round"
          initial={{ pathLength: reduce ? confidence : 0 }}
          animate={{ pathLength: confidence }}
          transition={{ duration: 0.8, ease: 'easeOut' }}
        />
      </svg>
      <span className="font-mono text-[9px] text-foreground/80">{Math.round(confidence * 100)}</span>
    </span>
  );
}

interface SimCardProps {
  item: SimItem;
  onReview: (id: string, step: ReviewStep) => void;
}

const BTN = 'inline-flex h-7 items-center rounded-md px-2.5 text-xs font-medium transition';

export function SimCard({ item, onReview }: SimCardProps) {
  const reduce = useReducedMotion();
  const launcher = useFlightLauncher();
  const inner = useRef<HTMLDivElement>(null);
  const meta = TYPE_META[item.type];
  const simNow = new Date(item.sentAt);
  const due = dueLabel(item.dueAt, simNow);

  // Fly-in: measure before paint, hide the real card, and let the ghost carry it from the chat
  // bubble to here. Skipped under reduced motion or if either end is out of view.
  useLayoutEffect(() => {
    const el = inner.current;
    if (!el || !launcher || reduce) return;
    const source = document.querySelector<HTMLElement>(`[data-sim-msg="${CSS.escape(item.sourceExternalId)}"]`);
    if (!source) return;
    const to = el.getBoundingClientRect();
    const from = source.getBoundingClientRect();
    const column = el.closest<HTMLElement>('[data-sim-column]')?.getBoundingClientRect();
    const visible =
      to.width > 0 &&
      to.top >= (column?.top ?? 0) &&
      to.bottom <= (column?.bottom ?? window.innerHeight) &&
      from.bottom > 0 &&
      from.top < window.innerHeight;
    if (!visible) return;
    const accepted = launcher.launch({
      id: item.id,
      from: { left: from.left, top: from.top, width: Math.min(from.width, 280), height: Math.min(from.height, 64) },
      to: { left: to.left, top: to.top, width: to.width, height: to.height },
      label: item.title,
      colour: `rgb(${meta.rgb})`,
      onLand: () => {
        if (el.isConnected) el.style.opacity = '';
      },
    });
    if (accepted) el.style.opacity = '0';
    // eslint-disable-next-line react-hooks/exhaustive-deps -- fly once per mount
  }, []);

  // Emerald glow when the card is approved (not on first mount).
  const [glow, setGlow] = useState(false);
  const previous = useRef(item.status);
  useEffect(() => {
    if (previous.current !== item.status && item.status === 'approved') {
      setGlow(true);
      const t = setTimeout(() => setGlow(false), 1100);
      previous.current = item.status;
      return () => clearTimeout(t);
    }
    previous.current = item.status;
  }, [item.status]);

  return (
    <motion.article
      layout={!reduce}
      layoutId={reduce ? undefined : item.id}
      data-sim-card={item.id}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0, transition: { duration: 0.12 } }}
      transition={{ type: 'spring', stiffness: 260, damping: 24 }}
    >
      <div
        ref={inner}
        className={`rounded-lg border bg-white/[0.04] p-3 transition-shadow duration-500 ${meta.border} ${
          glow ? 'shadow-glow' : ''
        }`}
      >
        <div className="flex items-start justify-between gap-2">
          <div className="flex flex-wrap items-center gap-1.5">
            <span className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${meta.chip}`}>{meta.label}</span>
            <span className={`rounded-full px-2 py-0.5 font-mono text-[11px] ${PRIORITY_CLASS[item.priority]}`}>
              {item.priority}
            </span>
          </div>
          <Ring confidence={item.confidence} />
        </div>

        <h3 className="mt-2 line-clamp-2 font-sans text-sm font-medium leading-snug">{item.title}</h3>

        <div className="mt-2 flex items-center gap-2 text-xs text-muted-foreground">
          {item.ownerName ? (
            <span className="flex min-w-0 items-center gap-1.5">
              <span
                aria-hidden
                className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[9px] font-semibold text-white"
                style={{ backgroundColor: avatarColour(item.ownerName) }}
              >
                {initials(item.ownerName)}
              </span>
              <span className="truncate">{item.ownerName}</span>
            </span>
          ) : (
            <span className="rounded-full border border-dashed border-white/20 px-2 py-0.5 text-[11px]">Unowned</span>
          )}
          {due && (
            <span className={`ml-auto shrink-0 font-mono ${due === 'overdue' ? 'text-urgent' : ''}`}>{due}</span>
          )}
        </div>

        <p className="mt-2 line-clamp-1 border-l-2 border-white/10 pl-2 text-[11px] italic text-muted-foreground">
          {item.sourceAuthor}: {item.sourceText}
        </p>

        {item.status === 'posted' && (
          <p className="mt-2 rounded-md bg-decision/10 px-2 py-1.5 text-xs text-decision">
            {postBackText(item, simNow)}
          </p>
        )}

        <div className="mt-2.5 flex flex-wrap items-center gap-1.5">
          {canExportIcs(item) && (
            <button type="button" className={`${BTN} bg-accent/10 text-accent hover:bg-accent/20`} onClick={() => {
              const url = URL.createObjectURL(new Blob([toIcs(item)], { type: 'text/calendar;charset=utf-8' }));
              const link = document.createElement('a'); link.href = url; link.download = 'clerk-event.ics'; link.click();
              setTimeout(() => URL.revokeObjectURL(url), 1000);
            }}>Export .ics</button>
          )}
          {item.status === 'pending' && (
            <>
              <button
                type="button"
                onClick={() => onReview(item.id, 'approve')}
                className={`${BTN} bg-success/15 text-success hover:bg-success/25`}
                aria-label={`Approve: ${item.title}`}
              >
                Approve
              </button>
              <button
                type="button"
                onClick={() => onReview(item.id, 'reject')}
                className={`${BTN} text-muted-foreground hover:bg-white/5 hover:text-foreground`}
                aria-label={`Reject: ${item.title}`}
              >
                Reject
              </button>
            </>
          )}
          {item.status === 'approved' && (
            <button
              type="button"
              onClick={() => onReview(item.id, 'post')}
              className={`${BTN} bg-primary/20 text-primary-300 hover:bg-primary/30`}
              aria-label={`Post (simulated): ${item.title}`}
            >
              Post (simulated)
            </button>
          )}
          {item.status === 'posted' && (
            <button
              type="button"
              onClick={() => onReview(item.id, 'done')}
              className={`${BTN} bg-white/10 text-foreground hover:bg-white/20`}
              aria-label={`Mark done: ${item.title}`}
            >
              Mark done
            </button>
          )}
          {item.status === 'done' && <span className="text-xs text-success">✓ Done</span>}
        </div>
      </div>
    </motion.article>
  );
}
