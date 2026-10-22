"use client";

import { motion, useReducedMotion } from "framer-motion";
import { useEffect, useMemo, useState } from "react";
import type { ReviewClient } from "./api-client";
import { getReviewClient } from "./api-client";
import { Kbd, headingFont, monoFont } from "./chips";
import { ConfirmPostDialog } from "./confirm-post-dialog";
import { EditDrawer } from "./edit-drawer";
import { knownOwners } from "./queue-logic";
import { ReassignDialog } from "./reassign-dialog";
import { ReviewFocus } from "./review-focus";
import { ReviewList } from "./review-list";
import { ToastProvider } from "./toast";
import type { ModalKind } from "./types";
import { useReviewQueue } from "./use-review-queue";

export interface ReviewWorkspaceProps {
  communityId: string;
  /** Who is reviewing; written to item_events. */
  actor?: string;
  /** Override for tests / storybook. Defaults to HTTP, or the in-memory mock when NEXT_PUBLIC_REVIEW_MOCK=1. */
  client?: ReviewClient;
}

export function ReviewWorkspace(props: ReviewWorkspaceProps) {
  return (
    <ToastProvider>
      <ReviewWorkspaceInner {...props} />
    </ToastProvider>
  );
}

function isTypingTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  return target.isContentEditable || ["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName);
}

function ReviewWorkspaceInner({ communityId, actor = "lead", client: clientProp }: ReviewWorkspaceProps) {
  const client = useMemo(() => clientProp ?? getReviewClient(), [clientProp]);
  const q = useReviewQueue({ communityId, actor, client });
  const reduced = useReducedMotion();
  const [modal, setModal] = useState<{ kind: Exclude<ModalKind, null>; itemId: string } | null>(null);

  // A modal is bound to one item. If that item leaves the queue (e.g. approved elsewhere), it closes.
  const modalItem = modal ? (q.items.find((i) => i.id === modal.itemId) ?? null) : null;
  const owners = useMemo(() => knownOwners(q.items), [q.items]);

  const open = (kind: Exclude<ModalKind, null>) => {
    if (q.selected) setModal({ kind, itemId: q.selected.id });
  };
  const close = () => setModal(null);

  const { selected, move, reject } = q;
  const modalOpen = modal !== null;

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.defaultPrevented || e.metaKey || e.ctrlKey || e.altKey) return;
      if (modalOpen || isTypingTarget(e.target)) return;
      switch (e.key.toLowerCase()) {
        case "j":
        case "arrowdown":
          e.preventDefault();
          move(1);
          break;
        case "k":
        case "arrowup":
          e.preventDefault();
          move(-1);
          break;
        case "a":
          if (selected) {
            e.preventDefault();
            setModal({ kind: "approve", itemId: selected.id });
          }
          break;
        case "e":
          if (selected) {
            e.preventDefault();
            setModal({ kind: "edit", itemId: selected.id });
          }
          break;
        case "r":
          if (selected) {
            e.preventDefault();
            setModal({ kind: "reassign", itemId: selected.id });
          }
          break;
        case "x":
          if (selected) {
            e.preventDefault();
            void reject(selected);
          }
          break;
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [modalOpen, move, reject, selected]);

  return (
    <div className="mx-auto w-full max-w-[1360px] px-4 py-10 text-foreground sm:px-8">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="page-heading">Review</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Check each card against its source. Nothing is posted until you approve it.
          </p>
        </div>
        <div className="flex items-center gap-4 text-sm">
          <span className="tabular-nums" style={monoFont} aria-live="polite">
            {q.items.length} waiting · {q.reviewed} reviewed
          </span>
          <LiveBadge pulse={q.pulse} offline={q.offline} reduced={Boolean(reduced)} />
        </div>
      </header>

      <div className="mt-8 grid gap-6 lg:grid-cols-[minmax(0,26rem)_minmax(0,1fr)] lg:items-start">
        <aside aria-label="Queue">
          {q.phase === "loading" ? (
            <div className="flex flex-col gap-2" aria-label="Loading queue" aria-busy="true">
              {[0, 1, 2, 3].map((n) => (
                <div key={n} className="h-24 animate-pulse rounded-xl bg-sunken" />
              ))}
            </div>
          ) : q.phase === "error" ? (
            <div className="rounded-xl border border-urgent/30 bg-surface p-4 text-sm" role="alert">
              <p>Couldn&apos;t load the queue.</p>
              <button
                type="button"
                onClick={q.retry}
                className="mt-3 rounded-lg border border-border px-3 py-1.5 hover:bg-sunken focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary"
              >
                Try again
              </button>
            </div>
          ) : (
            <ReviewList items={q.items} selectedId={q.selected?.id ?? null} exitKind={q.exitKind} onSelect={q.select} />
          )}
        </aside>

        <main className="min-w-0">
          {q.phase === "ready" && q.items.length === 0 ? (
            <motion.div
              initial={{ opacity: 0, y: reduced ? 0 : 8 }}
              animate={{ opacity: 1, y: 0 }}
              className="rounded-xl border border-dashed border-input px-6 py-16 text-center"
            >
              <p className="text-2xl font-semibold tracking-[-0.015em]" style={headingFont}>
                Inbox zero. Every message owned.
              </p>
              <p className="mt-2 text-sm text-muted-foreground">
                New items appear here the moment Clerk spots them. Anything it couldn&apos;t handle is in{" "}
                <a href="/failures" className="text-primary hover:underline">
                  the log
                </a>
                .
              </p>
            </motion.div>
          ) : (
            <ReviewFocus
              item={q.selected}
              client={client}
              exitKind={q.exitKind}
              position={{ index: Math.max(0, q.index), total: q.items.length }}
              onApprove={() => open("approve")}
              onEdit={() => open("edit")}
              onReassign={() => open("reassign")}
              onReject={() => q.selected && void q.reject(q.selected)}
            />
          )}
        </main>
      </div>

      <footer
        className="mt-8 flex flex-wrap items-center gap-x-5 gap-y-2 text-xs text-subtle"
        aria-label="Keyboard shortcuts"
      >
        <span>
          <Kbd>J</Kbd> <Kbd>K</Kbd> next / previous
        </span>
        <span>
          <Kbd>A</Kbd> approve
        </span>
        <span>
          <Kbd>E</Kbd> edit
        </span>
        <span>
          <Kbd>R</Kbd> reassign
        </span>
        <span>
          <Kbd>X</Kbd> reject
        </span>
      </footer>

      <ConfirmPostDialog
        item={modal?.kind === "approve" ? modalItem : null}
        onClose={close}
        onConfirm={(post) => {
          const item = modalItem;
          close();
          if (item) void q.approve(item, post);
        }}
      />
      <EditDrawer
        item={modal?.kind === "edit" ? modalItem : null}
        owners={owners}
        onClose={close}
        onSave={(patch) => {
          const item = modalItem;
          close();
          if (item) void q.edit(item, patch);
        }}
      />
      <ReassignDialog
        item={modal?.kind === "reassign" ? modalItem : null}
        owners={owners}
        onClose={close}
        onSave={(owner) => {
          const item = modalItem;
          close();
          if (item) void q.reassign(item, owner);
        }}
      />
    </div>
  );
}

function LiveBadge({ pulse, offline, reduced }: { pulse: number; offline: boolean; reduced: boolean }) {
  const colour = offline ? "#B45309" : "#15803D";
  return (
    <span
      className="inline-flex items-center gap-2 text-[13px] text-muted-foreground"
      title={offline ? "Can't reach Clerk. Retrying…" : "Checking for new items every few seconds"}
    >
      <span className="relative flex h-[7px] w-[7px]">
        {/* re-keyed on every new arrival so the ping replays */}
        {!offline && !reduced ? (
          <span
            key={pulse}
            aria-hidden
            className="absolute inline-flex h-full w-full animate-ping rounded-full opacity-75"
            style={{ background: colour, animationIterationCount: pulse === 0 ? 1 : 3 }}
          />
        ) : null}
        <span className="relative inline-flex h-[7px] w-[7px] rounded-full" style={{ background: colour }} />
      </span>
      {offline ? "Offline" : "Live"}
    </span>
  );
}
