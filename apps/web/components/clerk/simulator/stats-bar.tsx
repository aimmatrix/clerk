'use client';

import { animate, motion, useMotionValue, useReducedMotion, useTransform } from 'framer-motion';
import { useEffect } from 'react';

interface RollingNumberProps {
  value: number;
  decimals?: number;
  className?: string;
}

/** Counter that springs between values (rolls up on every change). */
export function RollingNumber({ value, decimals = 0, className }: RollingNumberProps) {
  const reduce = useReducedMotion();
  const mv = useMotionValue(value);
  const text = useTransform(mv, (v) => v.toFixed(decimals));

  useEffect(() => {
    if (reduce) {
      mv.set(value);
      return;
    }
    const controls = animate(mv, value, { type: 'spring', stiffness: 170, damping: 24 });
    return () => controls.stop();
  }, [value, reduce, mv]);

  return (
    <motion.span className={`tabular-nums ${className ?? ''}`} data-tabular>
      {text}
    </motion.span>
  );
}

interface StatsBarProps {
  captured: number;
  pending: number;
  hoursSaved: number;
  failures: number;
  ignored: number;
  pulse: number;
  playing: boolean;
}

const TILES = [
  { key: 'captured', label: 'Items captured', tone: 'text-foreground' },
  { key: 'pending', label: 'Awaiting review', tone: 'text-foreground' },
  { key: 'hoursSaved', label: 'Hours saved', tone: 'text-foreground' },
  { key: 'failures', label: "Couldn't handle", tone: 'text-foreground' },
] as const;

export function StatsBar({ captured, pending, hoursSaved, failures, ignored, pulse, playing }: StatsBarProps) {
  const reduce = useReducedMotion();
  const values = { captured, pending, hoursSaved, failures };

  return (
    <section
      aria-label="Simulator statistics"
      className="panel flex flex-wrap items-center gap-x-8 gap-y-3 px-5 py-3.5 max-lg:sticky max-lg:top-16 max-lg:z-30"
    >
      <div className="order-1 flex items-center gap-2" aria-live="off">
        <span className="relative flex h-[7px] w-[7px]">
          <motion.span
            key={pulse}
            aria-hidden
            className="absolute inline-flex h-full w-full rounded-full bg-accent"
            initial={reduce ? false : { scale: 1, opacity: 0.5 }}
            animate={reduce ? undefined : { scale: 2.4, opacity: 0 }}
            transition={{ duration: 0.9, ease: 'easeOut' }}
          />
          <span className={`relative inline-flex h-[7px] w-[7px] rounded-full ${playing ? 'bg-accent' : 'bg-input'}`} />
        </span>
        <span className="text-[13px] text-muted-foreground">{playing ? 'Running' : 'Paused'}</span>
      </div>

      <dl className="order-3 grid w-full grid-cols-2 gap-x-6 gap-y-3 sm:order-2 sm:w-auto sm:flex-1 sm:grid-cols-4">
        {TILES.map((tile) => (
          <div key={tile.key} className="min-w-0">
            <dt className="truncate text-xs text-subtle">{tile.label}</dt>
            <dd className={`mt-1 font-mono text-xl font-medium leading-none ${tile.tone}`}>
              <RollingNumber value={values[tile.key]} decimals={tile.key === 'hoursSaved' ? 1 : 0} />
            </dd>
          </div>
        ))}
      </dl>

      <p className="order-2 ml-auto text-xs text-subtle sm:order-3 sm:ml-0">
        <RollingNumber value={ignored} className="font-mono text-foreground" /> chatter ignored
      </p>
    </section>
  );
}
