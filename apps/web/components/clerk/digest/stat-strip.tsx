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
    { label: 'Captured', value: stats.captured, tone: 'text-[#E8EAF2]' },
    { label: 'Awaiting review', value: stats.pending, tone: 'text-[#F59E0B]' },
    { label: 'Approved', value: stats.approved, tone: 'text-[#34D399]' },
    { label: "Couldn't handle", value: stats.failures, tone: 'text-[#F43F5E]' },
    { label: 'Hours saved', value: stats.hoursSaved, decimals: 1, tone: 'text-[#22D3EE]' },
  ];

  return (
    <dl className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5" aria-label="Digest statistics">
      {items.map((s) => (
        <div
          key={s.label}
          className="rounded-xl border border-white/10 bg-[#141826]/60 px-4 py-3 backdrop-blur-xl"
        >
          <dt className="text-xs text-[#8A90A6]">{s.label}</dt>
          <dd className={`mt-1 font-mono text-2xl font-semibold tabular-nums ${s.tone}`}>
            <RollingNumber value={s.value} decimals={s.decimals} />
          </dd>
        </div>
      ))}
    </dl>
  );
}
