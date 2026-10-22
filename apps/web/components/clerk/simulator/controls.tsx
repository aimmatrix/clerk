'use client';

import type { SimSpeed, SimStatus } from './use-simulator';

interface ControlsProps {
  status: SimStatus;
  speed: SimSpeed;
  ready: boolean;
  cursor: number;
  total: number;
  onPlay: () => void;
  onPause: () => void;
  onReset: () => void;
  onSpeed: (speed: SimSpeed) => void;
}

const SPEEDS: SimSpeed[] = [1, 2, 4];

function PlayIcon() {
  return (
    <svg viewBox="0 0 20 20" width="16" height="16" fill="currentColor" aria-hidden>
      <path d="M6 4.2v11.6a.8.8 0 0 0 1.2.7l9.3-5.8a.8.8 0 0 0 0-1.4L7.2 3.5A.8.8 0 0 0 6 4.2Z" />
    </svg>
  );
}
function PauseIcon() {
  return (
    <svg viewBox="0 0 20 20" width="16" height="16" fill="currentColor" aria-hidden>
      <rect x="5" y="4" width="3.6" height="12" rx="1" />
      <rect x="11.4" y="4" width="3.6" height="12" rx="1" />
    </svg>
  );
}
function ResetIcon() {
  return (
    <svg viewBox="0 0 20 20" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M4 10a6 6 0 1 0 2-4.5" />
      <path d="M4 3.5v3.2h3.2" />
    </svg>
  );
}

export function Controls({ status, speed, ready, cursor, total, onPlay, onPause, onReset, onSpeed }: ControlsProps) {
  const playing = status === 'playing';
  const label = playing ? 'Pause' : status === 'finished' ? 'Replay' : status === 'paused' ? 'Resume' : 'Play';
  const progress = total > 0 ? Math.min(100, (cursor / total) * 100) : 0;

  return (
    <div className="flex flex-wrap items-center gap-3">
      <button
        type="button"
        onClick={playing ? onPause : onPlay}
        disabled={!ready}
        className="inline-flex h-9 items-center gap-2 rounded-md bg-primary-600 px-4 text-sm font-medium text-white shadow-glow-primary transition hover:bg-primary-600/90 disabled:cursor-not-allowed disabled:opacity-50"
      >
        {playing ? <PauseIcon /> : <PlayIcon />}
        {label}
      </button>

      <div role="group" aria-label="Playback speed" className="inline-flex rounded-md border border-border bg-white/[0.03] p-0.5">
        {SPEEDS.map((s) => (
          <button
            key={s}
            type="button"
            aria-pressed={speed === s}
            onClick={() => onSpeed(s)}
            className={`h-8 min-w-10 rounded-sm px-2.5 font-mono text-xs transition ${
              speed === s ? 'bg-white/10 text-foreground' : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            {s}×
          </button>
        ))}
      </div>

      <button
        type="button"
        onClick={onReset}
        disabled={status === 'idle' && cursor === 0}
        className="inline-flex h-9 items-center gap-2 rounded-md border border-border px-3 text-sm text-muted-foreground transition hover:bg-white/5 hover:text-foreground disabled:cursor-not-allowed disabled:opacity-40"
      >
        <ResetIcon />
        Reset
      </button>

      <div className="flex min-w-32 items-center gap-2" role="status" aria-live="off">
        <div className="h-1 w-24 overflow-hidden rounded-full bg-white/10" aria-hidden>
          <div className="h-full rounded-full bg-accent transition-[width] duration-300" style={{ width: `${progress}%` }} />
        </div>
        <span className="font-mono text-xs text-muted-foreground tabular-nums">
          {Math.min(cursor, total)}/{total}
        </span>
      </div>
    </div>
  );
}
