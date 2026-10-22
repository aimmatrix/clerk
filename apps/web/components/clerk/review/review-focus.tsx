"use client";

import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { useEffect, useRef, useState } from "react";
import type { Item } from "@clerk/core";
import type { ReviewClient } from "./api-client";
import { Avatar, ConfidenceMeter, Kbd, PriorityBadge, TypeChip, headingFont, monoFont } from "./chips";
import { formatAge, formatDateTime, formatDueShort, isOverdue } from "./format";
import type { ExitKind, SourceContext, SourceMessage } from "./types";

type ContextState =
  | { status: "loading" }
  | { status: "ready"; data: SourceContext }
  | { status: "unavailable" };

function useSourceContext(client: ReviewClient, item: Item | null): ContextState {
  const cache = useRef(new Map<string, SourceContext | null>());
  const [loaded, setLoaded] = useState<{ key: string; state: ContextState } | null>(null);
  const messageId = item?.messageId ?? null;

  useEffect(() => {
    if (!item || !messageId) return;
    const toState = (data: SourceContext | null): ContextState =>
      data ? { status: "ready", data } : { status: "unavailable" };
    if (cache.current.has(messageId)) {
      setLoaded({ key: messageId, state: toState(cache.current.get(messageId) ?? null) });
      return;
    }
    let cancelled = false;
    client
      .getSourceContext(item)
      .then((data) => {
        cache.current.set(messageId, data);
        if (!cancelled) setLoaded({ key: messageId, state: toState(data) });
      })
      .catch(() => {
        if (!cancelled) setLoaded({ key: messageId, state: { status: "unavailable" } });
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- keyed on the message, not the item object
  }, [client, messageId]);

  // Never show another message's context while the right one is still loading.
  return loaded && loaded.key === messageId ? loaded.state : { status: "loading" };
}

function ChatLine({ message, highlight }: { message: SourceMessage; highlight?: boolean }) {
  return (
    <li
      className={`rounded-lg px-3 py-2 text-sm leading-5 ${
        highlight ? "bg-background text-foreground" : "text-muted-foreground"
      }`}
    >
      <span className={highlight ? "font-semibold text-foreground" : "font-medium"}>{message.authorName}</span>
      <span className="ml-2 text-[11px] text-muted-foreground" style={monoFont}>
        {formatAge(message.sentAt)}
      </span>
      <p className="mt-0.5 whitespace-pre-wrap break-words">{message.content}</p>
    </li>
  );
}

function SourcePanel({ item, state }: { item: Item; state: ContextState }) {
  return (
    <section aria-labelledby="source-heading" className="mt-6">
      <h3 id="source-heading" className="text-xs text-subtle">
        Source message
      </h3>
      {state.status === "loading" ? (
        <div className="mt-2 h-16 animate-pulse rounded-lg bg-sunken" aria-label="Loading source message" />
      ) : state.status === "ready" ? (
        <ul className="mt-2 flex flex-col gap-1.5">
          {state.data.context.map((m) => (
            <ChatLine key={m.externalId} message={m} />
          ))}
          <ChatLine message={state.data.message} highlight />
        </ul>
      ) : (
        <p className="mt-2 rounded-lg border border-dashed border-border px-3 py-3 text-sm text-muted-foreground">
          The original message isn&apos;t available here. Clerk&apos;s summary:{" "}
          <span className="text-foreground">{item.summary ?? item.title}</span>
        </p>
      )}
      {item.sourceLink ? (
        <a
          href={item.sourceLink}
          target="_blank"
          rel="noreferrer noopener"
          className="mt-2 inline-block text-xs text-primary underline-offset-2 hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary"
        >
          Open in chat ↗
        </a>
      ) : null}
    </section>
  );
}

interface ReviewFocusProps {
  item: Item | null;
  client: ReviewClient;
  exitKind: ExitKind;
  position: { index: number; total: number };
  onApprove: () => void;
  onEdit: () => void;
  onReassign: () => void;
  onReject: () => void;
}

export function ReviewFocus({ item, client, exitKind, position, onApprove, onEdit, onReassign, onReject }: ReviewFocusProps) {
  const reduced = useReducedMotion();
  const source = useSourceContext(client, item);

  return (
    <AnimatePresence mode="wait" initial={false} custom={exitKind}>
      {item ? (
        <motion.article
          key={item.id}
          custom={exitKind}
          aria-label={`Reviewing: ${item.title}`}
          variants={{
            enter: { opacity: 0, y: reduced ? 0 : 6 },
            show: { opacity: 1, y: 0, boxShadow: "0 0 0 0 #15803D00", transition: { duration: 0.2 } },
            exit: (kind: ExitKind) =>
              reduced
                ? { opacity: 0, transition: { duration: 0.12 } }
                : kind === "approve"
                  ? { opacity: 0, boxShadow: "0 0 0 1px #15803D", transition: { duration: 0.25 } }
                  : kind === "reject"
                    ? { opacity: 0, y: 8, transition: { duration: 0.22 } }
                    : { opacity: 0, transition: { duration: 0.1 } },
          }}
          initial="enter"
          animate="show"
          exit="exit"
          className="panel p-6 sm:p-8"
        >
          <header className="flex flex-wrap items-center gap-2">
            <TypeChip type={item.type} />
            <PriorityBadge priority={item.priority} />
            <span className="ml-auto text-xs text-muted-foreground" style={monoFont}>
              {position.index + 1} of {position.total}
            </span>
          </header>

          <h2 className="mt-4 text-2xl font-semibold leading-8 tracking-[-0.015em]" style={headingFont}>
            {item.title}
          </h2>
          {item.summary ? <p className="mt-2 text-sm leading-6 text-muted-foreground">{item.summary}</p> : null}

          <dl className="mt-5 grid grid-cols-2 gap-4 text-sm sm:grid-cols-4">
            <div>
              <dt className="text-xs text-subtle">Owner</dt>
              <dd className="mt-1.5 flex items-center gap-2">
                <Avatar name={item.ownerName} />
                <span className={item.ownerName ? "font-medium" : "text-subtle"}>{item.ownerName ?? "Unassigned"}</span>
              </dd>
            </div>
            <div>
              <dt className="text-xs text-subtle">Due</dt>
              <dd className={`mt-1 ${isOverdue(item.dueAt) ? "text-urgent" : ""}`}>
                {item.dueAt ? formatDateTime(item.dueAt) : "No deadline"}
                {item.dueAt ? <span className="block text-xs text-muted-foreground">{formatDueShort(item.dueAt)}</span> : null}
              </dd>
            </div>
            <div>
              <dt className="text-xs text-subtle">Urgency</dt>
              <dd className="mt-1 tabular-nums" style={monoFont}>
                {item.urgencyScore}
                <span className="text-muted-foreground"> / 100</span>
              </dd>
            </div>
            <div>
              <dt className="text-xs text-subtle">Confidence</dt>
              <dd className="mt-1.5">
                <ConfidenceMeter value={item.confidence} />
              </dd>
            </div>
          </dl>

          {item.type === "question" ? (
            <section aria-labelledby="reply-heading" className="mt-6">
              <h3 id="reply-heading" className="text-xs text-subtle">
                Suggested reply
              </h3>
              <p className="mt-2 rounded-lg border border-border px-3.5 py-3 text-sm leading-6">
                {item.suggestedReply ?? "Clerk didn't draft a reply. Press E to write one."}
              </p>
            </section>
          ) : null}

          {item.type === "event" ? (
            <section aria-labelledby="event-heading" className="mt-6">
              <h3 id="event-heading" className="text-xs text-subtle">
                Event details
              </h3>
              <p className="mt-2 text-sm leading-6">
                {item.eventStart ? formatDateTime(item.eventStart) : "Start time unknown"}
                {item.eventLocation ? ` · ${item.eventLocation}` : ""}
              </p>
              <a
                href={client.icsUrl(item.id)}
                className="mt-1 inline-block text-xs text-primary underline-offset-2 hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary"
              >
                Download .ics
              </a>
            </section>
          ) : null}

          <SourcePanel item={item} state={source} />

          <div className="mt-8 flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={onApprove}
              className="inline-flex min-h-[44px] items-center gap-2 rounded-lg bg-primary px-4 text-sm font-medium text-white transition-colors hover:bg-primary-600 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
            >
              Approve <Kbd>A</Kbd>
            </button>
            <GhostButton onClick={onEdit} hint="E">
              Edit
            </GhostButton>
            <GhostButton onClick={onReassign} hint="R">
              Reassign
            </GhostButton>
            <GhostButton onClick={onReject} hint="X" danger>
              Reject
            </GhostButton>
          </div>
        </motion.article>
      ) : null}
    </AnimatePresence>
  );
}

function GhostButton({
  children,
  hint,
  onClick,
  danger = false,
}: {
  children: string;
  hint: string;
  onClick: () => void;
  danger?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`inline-flex min-h-[44px] items-center gap-2 rounded-lg px-4 text-sm transition-colors hover:bg-sunken focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary ${
        danger ? "ml-auto text-muted-foreground" : "border border-input bg-surface text-foreground"
      }`}
    >
      {children} <Kbd>{hint}</Kbd>
    </button>
  );
}
