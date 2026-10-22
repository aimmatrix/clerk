'use client';

import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { useCallback, useEffect, useRef } from 'react';
import { FAILURE_LABEL, TYPE_META, avatarColour, clock, initials } from './format';
import type { Chip } from './pipeline';
import type { SimMessage, SimStatus } from './use-simulator';

function Avatar({ name }: { name: string }) {
  return (
    <span
      aria-hidden
      className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-[11px] font-semibold text-white"
      style={{ backgroundColor: avatarColour(name) }}
    >
      {initials(name)}
    </span>
  );
}

function OutcomeChip({ chip }: { chip: Chip }) {
  if (chip.kind === 'noise') {
    return <span className="rounded-full bg-white/5 px-2 py-0.5 text-[11px] text-muted-foreground">Ignored · chatter</span>;
  }
  if (chip.kind === 'failure') {
    return (
      <span className="rounded-full bg-urgent/15 px-2 py-0.5 text-[11px] text-urgent">
        Couldn&apos;t handle · {FAILURE_LABEL[chip.reason].toLowerCase()}
      </span>
    );
  }
  const meta = TYPE_META[chip.type];
  return (
    <span className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${meta.chip}`}>
      → {meta.label} · {chip.priority}
    </span>
  );
}

function Reading() {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full bg-white/5 px-2 py-0.5 text-[11px] text-muted-foreground">
      <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-accent" aria-hidden />
      Clerk is reading…
    </span>
  );
}

interface ChatPaneProps {
  messages: SimMessage[];
  typing: string | null;
  status: SimStatus;
}

export function ChatPane({ messages, typing, status }: ChatPaneProps) {
  const reduce = useReducedMotion();
  const scroller = useRef<HTMLDivElement>(null);
  const stick = useRef(true);

  // Only user input may release the auto-follow. Reacting to every scroll event would also catch
  // our own smooth scroll (a tall bubble lands mid-scroll and looks like "scrolled away").
  const onUserScroll = () =>
    requestAnimationFrame(() => {
      const el = scroller.current;
      if (el) stick.current = el.scrollHeight - el.scrollTop - el.clientHeight < 80;
    });

  const follow = useCallback(() => {
    const el = scroller.current;
    if (!el || !stick.current) return;
    // Smooth for the normal 1-message nudge; snap if we've fallen far behind (e.g. at 4×).
    const behind = el.scrollHeight - el.scrollTop - el.clientHeight;
    el.scrollTo({ top: el.scrollHeight, behavior: reduce || behind > 360 ? 'auto' : 'smooth' });
  }, [reduce]);

  const empty = messages.length === 0;

  // New messages, typing row, and late growth (placeholder → outcome chips) all keep us pinned.
  useEffect(() => {
    if (empty) stick.current = true;
    follow();
  }, [messages, typing, empty, follow]);

  useEffect(() => {
    const content = scroller.current?.firstElementChild;
    if (!content) return;
    const observer = new ResizeObserver(follow);
    observer.observe(content);
    return () => observer.disconnect();
  }, [empty, follow]);

  const byId = new Map(messages.map((m) => [m.message.externalId, m.message]));

  return (
    <section aria-label="Simulated community chat" className="glass flex min-h-0 flex-col overflow-hidden rounded-lg">
      <div className="flex items-center gap-2 border-b border-accent/20 bg-accent/10 px-4 py-2 text-xs font-medium text-accent">
        <span aria-hidden>●</span>
        Clerk Demo Mode — simulated community chat
      </div>
      <div className="flex items-center justify-between border-b border-border px-4 py-2.5">
        <h2 className="font-display text-sm font-semibold">Shoreditch Builders</h2>
        <span className="text-xs text-muted-foreground">Simulated community · all channels</span>
      </div>

      <div
        ref={scroller}
        onWheel={onUserScroll}
        onTouchMove={onUserScroll}
        onPointerUp={onUserScroll}
        onKeyUp={onUserScroll}
        tabIndex={0}
        role="region"
        aria-label="Chat history"
        className="min-h-0 flex-1 overflow-y-auto px-4 py-3"
      >
        {messages.length === 0 && !typing ? (
          <div className="flex h-full min-h-48 flex-col items-center justify-center gap-2 text-center">
            <p className="font-display text-lg font-semibold">
              {status === 'idle' ? 'A busy chat, about to be owned.' : 'Waiting for the first message…'}
            </p>
            <p className="max-w-xs text-sm text-muted-foreground">
              Press Play and watch each message turn into a task, request, event or decision, or get honestly
              marked as something Clerk couldn&apos;t handle.
            </p>
          </div>
        ) : (
          <ol role="log" aria-live="polite" aria-label="Chat messages" className="flex flex-col gap-3">
            <AnimatePresence initial={false}>
              {messages.map(({ message, chips }) => {
                const parent = message.replyToExternalId ? byId.get(message.replyToExternalId) : undefined;
                return (
                  <motion.li
                    key={message.externalId}
                    id={`msg-${message.externalId}`}
                    data-sim-msg={message.externalId}
                    initial={reduce ? { opacity: 0 } : { opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.25, ease: 'easeOut' }}
                    className="flex gap-2.5 rounded-md p-1"
                  >
                    <Avatar name={message.authorName} />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-baseline gap-2">
                        <span className="text-sm font-medium">{message.authorName}</span>
                        <time className="font-mono text-[11px] text-muted-foreground" dateTime={message.sentAt}>
                          {clock(message.sentAt)}
                        </time>
                        {message.channelId && (
                          <span className="text-[11px] text-muted-foreground/70">#{message.channelId}</span>
                        )}
                      </div>
                      {parent && (
                        <p className="mt-0.5 truncate border-l-2 border-white/15 pl-2 text-xs text-muted-foreground">
                          ↩ {parent.authorName}: {parent.content}
                        </p>
                      )}
                      <p className="mt-0.5 break-words text-sm text-foreground/90">{message.content}</p>
                      <div className="mt-1.5 min-h-5">
                        {chips === null ? (
                          <Reading />
                        ) : (
                          <motion.div
                            className="flex flex-wrap gap-1.5"
                            initial={reduce ? { opacity: 0 } : { opacity: 0, scale: 0.9 }}
                            animate={{ opacity: 1, scale: 1 }}
                            transition={{ duration: 0.2 }}
                          >
                            {chips.map((chip, i) => (
                              <OutcomeChip key={i} chip={chip} />
                            ))}
                          </motion.div>
                        )}
                      </div>
                    </div>
                  </motion.li>
                );
              })}
            </AnimatePresence>
            {typing && (
              <li className="flex items-center gap-2.5 p-1 text-xs text-muted-foreground" aria-hidden>
                <Avatar name={typing} />
                <span>{typing} is typing</span>
                <span className="flex gap-0.5">
                  {[0, 1, 2].map((d) => (
                    <span
                      key={d}
                      className="h-1 w-1 animate-bounce rounded-full bg-muted-foreground"
                      style={{ animationDelay: `${d * 120}ms` }}
                    />
                  ))}
                </span>
              </li>
            )}
          </ol>
        )}
      </div>
    </section>
  );
}
