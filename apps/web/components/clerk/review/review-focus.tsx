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
        highlight ? "border-l-2 border-[#7C5CFF] bg-[#7C5CFF]/10 text-[#E8EAF2]" : "text-[#8A90A6]"
      }`}
    >
      <span className={highlight ? "font-semibold text-[#E8EAF2]" : "font-medium"}>{message.authorName}</span>
      <span className="ml-2 text-[11px] text-[#8A90A6]" style={monoFont}>
        {formatAge(message.sentAt)}
      </span>
      <p className="mt-0.5 whitespace-pre-wrap break-words">{message.content}</p>
    </li>
  );
}

function SourcePanel({ item, state }: { item: Item; state: ContextState }) {
  return (
    <section aria-labelledby="source-heading" className="mt-6">
      <h3 id="source-heading" className="text-xs font-medium uppercase tracking-wide text-[#8A90A6]">
        Source message
      </h3>
      {state.status === "loading" ? (
        <div className="mt-2 h-16 animate-pulse rounded-lg bg-white/5" aria-label="Loading source message" />
      ) : state.status === "ready" ? (
        <ul className="mt-2 flex flex-col gap-1.5">
          {state.data.context.map((m) => (
            <ChatLine key={m.externalId} message={m} />
          ))}
          <ChatLine message={state.data.message} highlight />
        </ul>
      ) : (
        <p className="mt-2 rounded-lg border border-dashed border-white/10 px-3 py-3 text-sm text-[#8A90A6]">
          The original message isn&apos;t available here. Clerk&apos;s summary:{" "}
          <span className="text-[#E8EAF2]">{item.summary ?? item.title}</span>
        </p>
      )}
      {item.sourceLink ? (
        <a
          href={item.sourceLink}
          target="_blank"
          rel="noreferrer noopener"
          className="mt-2 inline-block text-xs text-[#A593FF] underline-offset-2 hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#7C5CFF]"
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
            show: { opacity: 1, y: 0, scale: 1, boxShadow: "0 0 0 0 #34D39900", transition: { duration: 0.2 } },
            exit: (kind: ExitKind) =>
              reduced
                ? { opacity: 0, transition: { duration: 0.12 } }
                : kind === "approve"
                  ? { opacity: 0, scale: 1.04, boxShadow: "0 0 48px 4px #34D39988", transition: { duration: 0.32 } }
                  : kind === "reject"
                    ? { opacity: 0, y: 8, transition: { duration: 0.22 } }
                    : { opacity: 0, transition: { duration: 0.1 } },
          }}
          initial="enter"
          animate="show"
          exit="exit"
          className="rounded-2xl border border-white/10 bg-[#141826]/60 p-6 backdrop-blur-xl"
        >
          <header className="flex flex-wrap items-center gap-2">
            <TypeChip type={item.type} />
            <PriorityBadge priority={item.priority} />
            <span className="ml-auto text-xs text-[#8A90A6]" style={monoFont}>
              {position.index + 1} of {position.total}
            </span>
          </header>

          <h2 className="mt-4 text-2xl font-semibold leading-8 tracking-tight" style={headingFont}>
            {item.title}
          </h2>
          {item.summary ? <p className="mt-2 text-sm leading-6 text-[#B5BACB]">{item.summary}</p> : null}

          <dl className="mt-5 grid grid-cols-2 gap-4 text-sm sm:grid-cols-4">
            <div>
              <dt className="text-xs text-[#8A90A6]">Owner</dt>
              <dd className="mt-1 flex items-center gap-2">
                <Avatar name={item.ownerName} />
                <span className={item.ownerName ? "" : "text-[#F59E0B]"}>{item.ownerName ?? "Unassigned"}</span>
              </dd>
            </div>
            <div>
              <dt className="text-xs text-[#8A90A6]">Due</dt>
              <dd className={`mt-1 ${isOverdue(item.dueAt) ? "text-[#F43F5E]" : ""}`}>
                {item.dueAt ? formatDateTime(item.dueAt) : "No deadline"}
                {item.dueAt ? <span className="block text-xs text-[#8A90A6]">{formatDueShort(item.dueAt)}</span> : null}
              </dd>
            </div>
            <div>
              <dt className="text-xs text-[#8A90A6]">Urgency</dt>
              <dd className="mt-1 tabular-nums" style={monoFont}>
                {item.urgencyScore}
                <span className="text-[#8A90A6]"> / 100</span>
              </dd>
            </div>
            <div>
              <dt className="text-xs text-[#8A90A6]">Confidence</dt>
              <dd className="mt-1.5">
                <ConfidenceMeter value={item.confidence} />
              </dd>
            </div>
          </dl>

          {item.type === "question" ? (
            <section aria-labelledby="reply-heading" className="mt-6">
              <h3 id="reply-heading" className="text-xs font-medium uppercase tracking-wide text-[#8A90A6]">
                Suggested reply
              </h3>
              <p className="mt-2 rounded-lg border border-[#60A5FA]/30 bg-[#60A5FA]/10 px-3 py-3 text-sm leading-6">
                {item.suggestedReply ?? "Clerk didn't draft a reply. Press E to write one."}
              </p>
            </section>
          ) : null}

          {item.type === "event" ? (
            <section aria-labelledby="event-heading" className="mt-6">
              <h3 id="event-heading" className="text-xs font-medium uppercase tracking-wide text-[#8A90A6]">
                Event details
              </h3>
              <p className="mt-2 text-sm leading-6">
                {item.eventStart ? formatDateTime(item.eventStart) : "Start time unknown"}
                {item.eventLocation ? ` · ${item.eventLocation}` : ""}
              </p>
              <a
                href={client.icsUrl(item.id)}
                className="mt-1 inline-block text-xs text-[#A593FF] underline-offset-2 hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#7C5CFF]"
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
              className="inline-flex items-center gap-2 rounded-lg bg-[#7C5CFF] px-4 py-2 text-sm font-semibold text-white transition hover:brightness-110 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#A593FF]"
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
      className={`inline-flex items-center gap-2 rounded-lg border px-3 py-2 text-sm transition hover:bg-white/5 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#7C5CFF] ${
        danger ? "border-[#F43F5E]/30 text-[#F43F5E]" : "border-white/10 text-[#E8EAF2]"
      }`}
    >
      {children} <Kbd>{hint}</Kbd>
    </button>
  );
}
