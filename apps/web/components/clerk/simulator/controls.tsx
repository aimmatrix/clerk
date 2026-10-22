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
        className="inline-flex min-h-[44px] min-w-[96px] items-center justify-center gap-2 rounded-lg bg-primary px-[18px] text-sm font-medium text-white transition-colors hover:bg-primary-600 disabled:cursor-not-allowed disabled:opacity-50"
      >
        {playing ? <PauseIcon /> : <PlayIcon />}
        {label}
      </button>

      <div role="group" aria-label="Playback speed" className="inline-flex rounded-lg border border-border bg-surface p-0.5">
        {SPEEDS.map((s) => (
          <button
            key={s}
            type="button"
            aria-pressed={speed === s}
            onClick={() => onSpeed(s)}
            className={`h-9 min-w-10 rounded-md px-2.5 font-mono text-xs transition-colors ${
              speed === s ? 'bg-foreground text-background' : 'text-muted-foreground hover:text-foreground'
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
        className="inline-flex min-h-[44px] items-center gap-2 rounded-lg border border-input bg-surface px-4 text-sm text-foreground transition-colors hover:bg-sunken hover:text-foreground disabled:cursor-not-allowed disabled:opacity-40"
      >
        <ResetIcon />
        Reset
      </button>

      <div className="flex min-w-32 items-center gap-2" role="status" aria-live="off">
        <div className="h-1 w-24 overflow-hidden rounded-full bg-sunken" aria-hidden>
          <div className="h-full rounded-full bg-foreground transition-[width] duration-300" style={{ width: `${progress}%` }} />
        </div>
        <span className="font-mono text-xs text-subtle tabular-nums">
          {Math.min(cursor, total)}/{total}
        </span>
      </div>
    </div>
  );
}
