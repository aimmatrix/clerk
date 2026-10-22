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
  { key: 'pending', label: 'Awaiting review', tone: 'text-request' },
  { key: 'hoursSaved', label: 'Hours saved', tone: 'text-decision' },
  { key: 'failures', label: "Couldn't handle", tone: 'text-urgent' },
] as const;

export function StatsBar({ captured, pending, hoursSaved, failures, ignored, pulse, playing }: StatsBarProps) {
  const reduce = useReducedMotion();
  const values = { captured, pending, hoursSaved, failures };

  return (
    <section
      aria-label="Simulator statistics"
      className="glass flex flex-wrap items-center gap-x-6 gap-y-3 rounded-lg px-4 py-3 max-lg:sticky max-lg:top-16 max-lg:z-30"
    >
      <div className="order-1 flex items-center gap-2" aria-live="off">
        <span className="relative flex h-2.5 w-2.5">
          <motion.span
            key={pulse}
            aria-hidden
            className="absolute inline-flex h-full w-full rounded-full bg-accent"
            initial={reduce ? false : { scale: 1, opacity: 0.8 }}
            animate={reduce ? undefined : { scale: 3, opacity: 0 }}
            transition={{ duration: 0.9, ease: 'easeOut' }}
          />
          <span className={`relative inline-flex h-2.5 w-2.5 rounded-full ${playing ? 'bg-accent' : 'bg-accent/50'}`} />
        </span>
        <span className="text-xs font-medium uppercase tracking-wider text-accent">Live</span>
      </div>

      <dl className="order-3 grid w-full grid-cols-2 gap-x-6 gap-y-3 sm:order-2 sm:w-auto sm:flex-1 sm:grid-cols-4">
        {TILES.map((tile) => (
          <div key={tile.key} className="min-w-0">
            <dt className="truncate text-xs text-muted-foreground">{tile.label}</dt>
            <dd className={`font-display text-2xl font-semibold leading-none ${tile.tone}`}>
              <RollingNumber value={values[tile.key]} decimals={tile.key === 'hoursSaved' ? 1 : 0} />
            </dd>
          </div>
        ))}
      </dl>

      <p className="order-2 ml-auto text-xs text-muted-foreground sm:order-3 sm:ml-0">
        <RollingNumber value={ignored} className="font-mono text-foreground/80" /> chatter ignored
      </p>
    </section>
  );
}
