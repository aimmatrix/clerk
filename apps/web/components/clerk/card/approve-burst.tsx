'use client';

import { useMemo } from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import { SUCCESS_COLOUR } from './tokens';

export interface ApproveBurstProps {
  /** Number of particles. The brief asks for 12. */
  count?: number;
  /** Fired once when the last particle has faded out; use it to unmount the burst. */
  onComplete?: () => void;
  colour?: string;
}

/**
 * Emerald particle burst, centred on its (relatively positioned) parent.
 * Purely decorative: aria-hidden, pointer-events none, skipped entirely under reduced motion.
 */
export function ApproveBurst({ count = 12, onComplete, colour = SUCCESS_COLOUR }: ApproveBurstProps) {
  const reduced = useReducedMotion();

  const particles = useMemo(
    () =>
      Array.from({ length: count }, (_, i) => {
        const angle = (i / count) * Math.PI * 2;
        // Alternate near/far rings so the burst reads as layered rather than a flat circle.
        const distance = i % 2 === 0 ? 54 : 34;
        return {
          x: Math.cos(angle) * distance,
          y: Math.sin(angle) * distance,
          size: i % 3 === 0 ? 7 : 5,
          delay: (i % 4) * 0.015,
        };
      }),
    [count],
  );

  if (reduced) return null;

  return (
    <span aria-hidden className="pointer-events-none absolute left-1/2 top-1/2 z-20 h-0 w-0">
      {particles.map((p, i) => (
        <motion.span
          key={i}
          className="absolute rounded-full"
          style={{
            width: p.size,
            height: p.size,
            marginLeft: -p.size / 2,
            marginTop: -p.size / 2,
            background: colour,
            boxShadow: `0 0 8px ${colour}`,
          }}
          initial={{ x: 0, y: 0, opacity: 1, scale: 1 }}
          animate={{ x: p.x, y: p.y, opacity: 0, scale: 0.3 }}
          transition={{ duration: 0.55, delay: p.delay, ease: 'easeOut' }}
          onAnimationComplete={i === particles.length - 1 ? onComplete : undefined}
        />
      ))}
    </span>
  );
}
