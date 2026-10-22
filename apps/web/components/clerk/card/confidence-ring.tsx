'use client';

import type { ReactNode } from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import { confidenceColour } from './tokens';

export interface ConfidenceRingProps {
  /** 0–1. Values outside the range are clamped. */
  confidence: number;
  /** Outer diameter in px. The avatar passed as children should be about `size - 2 * (stroke + 2)`. */
  size?: number;
  stroke?: number;
  children?: ReactNode;
  className?: string;
}

/** SVG ring that animates 0 → confidence around its children (the owner avatar). */
export function ConfidenceRing({ confidence, size = 44, stroke = 3, children, className }: ConfidenceRingProps) {
  const reduced = useReducedMotion();
  const value = Math.min(1, Math.max(0, Number.isFinite(confidence) ? confidence : 0));
  const colour = confidenceColour(value);
  const radius = (size - stroke) / 2;
  const centre = size / 2;

  return (
    <div
      role="img"
      aria-label={`Confidence ${Math.round(value * 100)} per cent`}
      className={['relative inline-flex shrink-0 items-center justify-center', className].filter(Boolean).join(' ')}
      style={{ width: size, height: size }}
      data-confidence={value.toFixed(2)}
    >
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="absolute inset-0 -rotate-90" aria-hidden>
        <circle cx={centre} cy={centre} r={radius} fill="none" stroke="rgba(255,255,255,0.1)" strokeWidth={stroke} />
        <motion.circle
          cx={centre}
          cy={centre}
          r={radius}
          fill="none"
          stroke={colour}
          strokeWidth={stroke}
          strokeLinecap="round"
          initial={{ pathLength: reduced ? value : 0 }}
          animate={{ pathLength: value }}
          transition={reduced ? { duration: 0 } : { duration: 0.8, ease: 'easeOut' }}
        />
      </svg>
      {children}
    </div>
  );
}
