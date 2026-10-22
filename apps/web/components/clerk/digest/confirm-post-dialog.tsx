'use client';

import { useEffect, useId, useRef } from 'react';

/**
 * Approval gate: nothing is posted to Discord unless the reviewer presses
 * "Post to Discord" here. Initial focus lands on Cancel, Esc cancels, Tab is trapped.
 */
export function ConfirmPostDialog({
  open,
  content,
  simulated,
  posting,
  onCancel,
  onConfirm,
}: {
  open: boolean;
  content: string;
  /** Demo community — nothing is actually sent. */
  simulated: boolean;
  posting: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  const titleId = useId();
  const descId = useId();
  const panelRef = useRef<HTMLDivElement>(null);
  const cancelRef = useRef<HTMLButtonElement>(null);
  const returnFocusRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (!open) return;
    returnFocusRef.current = document.activeElement as HTMLElement | null;
    cancelRef.current?.focus();
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = previousOverflow;
      returnFocusRef.current?.focus?.();
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !posting) {
        e.stopPropagation();
        onCancel();
        return;
      }
      if (e.key !== 'Tab' || !panelRef.current) return;
      const focusable = panelRef.current.querySelectorAll<HTMLElement>(
        'button:not([disabled]), [href], textarea, [tabindex]:not([tabindex="-1"])',
      );
      if (focusable.length === 0) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    };
    document.addEventListener('keydown', onKey, true);
    return () => document.removeEventListener('keydown', onKey, true);
  }, [open, posting, onCancel]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget && !posting) onCancel();
      }}
    >
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={descId}
        className="w-full max-w-lg rounded-xl border border-border bg-surface p-6 shadow-pop"
      >
        <h2 id={titleId} className="text-lg font-semibold text-foreground">
          Post digest to Discord?
        </h2>
        <p id={descId} className="mt-1 text-sm text-muted-foreground">
          {simulated
            ? 'Demo mode — this is simulated and nothing will be sent. Here is what would be posted:'
            : 'This will be posted publicly to your community channel. Check it over first:'}
        </p>

        <pre
          tabIndex={0}
          className="mt-4 max-h-72 overflow-auto whitespace-pre-wrap break-words rounded-lg border border-border bg-background p-3 font-mono text-xs leading-relaxed text-muted-foreground focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary"
        >
          {content}
        </pre>
        <p className="mt-1 text-right font-mono text-[11px] tabular-nums text-muted-foreground">
          {content.length} / 2000
        </p>

        <div className="mt-5 flex justify-end gap-3">
          <button
            ref={cancelRef}
            type="button"
            onClick={onCancel}
            disabled={posting}
            className="rounded-lg border border-input bg-surface px-4 py-2 text-sm text-foreground transition-colors hover:bg-sunken focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={posting}
            className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-primary-600 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary disabled:opacity-60"
          >
            {posting ? 'Posting…' : simulated ? 'Simulate post' : 'Post to Discord'}
          </button>
        </div>
      </div>
    </div>
  );
}
