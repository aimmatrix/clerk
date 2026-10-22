'use client';

import { motion, useReducedMotion } from 'framer-motion';
import type { ConnectionStatus } from '@/lib/realtime';

export interface LiveBadgeProps {
  /** Increment on every insert; each change fires one soft pulse. */
  pulseKey: number;
  /** Realtime connection state. Omit for sources without one (demo mode, controlled items). */
  status?: ConnectionStatus;
}

const STATUS_COPY: Record<ConnectionStatus, { label: string; description: string; colour: string }> = {
  live: { label: 'Live', description: 'Live: the board updates as messages arrive', colour: '#15803D' },
  connecting: { label: 'Connecting', description: 'Connecting to the live feed', colour: '#71717A' },
  reconnecting: { label: 'Reconnecting', description: 'Live feed lost, reconnecting', colour: '#B45309' },
  offline: { label: 'Offline', description: 'Not connected: the board refreshes by polling', colour: '#71717A' },
};

export function LiveBadge({ pulseKey, status = 'live' }: LiveBadgeProps) {
  const reduced = useReducedMotion();
  const { label, description, colour } = STATUS_COPY[status];
  const pulses = status === 'live' && !reduced && pulseKey > 0;

  return (
    <span
      role="status"
      aria-label={description}
      className="inline-flex items-center gap-2 text-[13px] text-muted-foreground"
    >
      <span className="relative flex h-[7px] w-[7px]" aria-hidden>
        <span className="absolute inset-0 rounded-full" style={{ background: colour }} />
        {pulses ? (
          <motion.span
            key={pulseKey}
            className="absolute inset-0 rounded-full"
            style={{ background: colour }}
            initial={{ scale: 1, opacity: 0.6 }}
            animate={{ scale: 2.6, opacity: 0 }}
            transition={{ duration: 0.9, ease: 'easeOut' }}
          />
        ) : null}
      </span>
      {label}
    </span>
  );
}
