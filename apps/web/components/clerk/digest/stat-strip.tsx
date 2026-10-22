'use client';

import { useEffect } from 'react';
import { animate, motion, useMotionValue, useReducedMotion, useTransform } from 'framer-motion';
import type { Digest } from '@clerk/core';

function RollingNumber({ value, decimals = 0 }: { value: number; decimals?: number }) {
  const reduce = useReducedMotion();
  const mv = useMotionValue(reduce ? value : 0);
  const text = useTransform(mv, (v) => v.toFixed(decimals));

  useEffect(() => {
    if (reduce) {
      mv.set(value);
      return;
    }
    const controls = animate(mv, value, { type: 'spring', stiffness: 120, damping: 20 });
    return () => controls.stop();
  }, [value, reduce, mv]);

  return <motion.span>{text}</motion.span>;
}

interface Stat {
  label: string;
  value: number;
  decimals?: number;
  suffix?: string;
  tone: string;
}

export function StatStrip({ stats }: { stats: Digest['stats'] }) {
  const items: Stat[] = [
    { label: 'Captured', value: stats.captured, tone: 'text-foreground' },
    { label: 'Awaiting review', value: stats.pending, tone: 'text-foreground' },
    { label: 'Approved', value: stats.approved, tone: 'text-foreground' },
    { label: "Couldn't handle", value: stats.failures, tone: 'text-foreground' },
    { label: 'Hours saved', value: stats.hoursSaved, decimals: 1, tone: 'text-foreground' },
  ];

  return (
    <dl className="panel grid grid-cols-2 overflow-hidden sm:grid-cols-3 lg:grid-cols-5" aria-label="Digest statistics">
      {items.map((s) => (
        <div
          key={s.label}
          className="border-b border-r border-border px-5 py-4 last:border-r-0 sm:[&:nth-child(3n)]:border-r-0 lg:[&:nth-child(3n)]:border-r lg:border-b-0"
        >
          <dt className="text-xs text-subtle">{s.label}</dt>
          <dd className={`mt-1 text-2xl font-semibold tabular-nums ${s.tone}`}>
            <RollingNumber value={s.value} decimals={s.decimals} />
          </dd>
        </div>
      ))}
    </dl>
  );
}
