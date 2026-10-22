'use client';

import { motion, useReducedMotion } from 'framer-motion';
import type { ConnectionStatus } from '@/lib/realtime';

export interface LiveBadgeProps {
  /** Increment on every insert; each change fires one cyan pulse. */
  pulseKey: number;
  /** Realtime connection state. Omit for sources without one (demo mode, controlled items). */
  status?: ConnectionStatus;
}

const STATUS_COPY: Record<ConnectionStatus, { label: string; description: string; colour: string }> = {
  live: { label: 'Live', description: 'Live: the board updates as messages arrive', colour: '#22D3EE' },
  connecting: { label: 'Connecting', description: 'Connecting to the live feed', colour: '#8A90A6' },
  reconnecting: { label: 'Reconnecting', description: 'Live feed lost, reconnecting', colour: '#F59E0B' },
  offline: { label: 'Offline', description: 'Not connected: the board refreshes by polling', colour: '#8A90A6' },
};

export function LiveBadge({ pulseKey, status = 'live' }: LiveBadgeProps) {
  const reduced = useReducedMotion();
  const { label, description, colour } = STATUS_COPY[status];
  const pulses = status === 'live' && !reduced && pulseKey > 0;

  return (
    <span
      role="status"
      aria-label={description}
      className="inline-flex items-center gap-2 rounded-full border px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wider"
      style={{ color: colour, borderColor: `${colour}4D`, background: `${colour}1A` }}
    >
      <span className="relative flex h-2 w-2" aria-hidden>
        <span className="absolute inset-0 rounded-full" style={{ background: colour }} />
        {pulses ? (
          <motion.span
            key={pulseKey}
            className="absolute inset-0 rounded-full"
            style={{ background: colour }}
            initial={{ scale: 1, opacity: 0.8 }}
            animate={{ scale: 3.2, opacity: 0 }}
            transition={{ duration: 0.9, ease: 'easeOut' }}
          />
        ) : null}
      </span>
      {label}
    </span>
  );
}
