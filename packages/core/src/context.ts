import type { IncomingMessage } from './types';

const MINUTE_MS = 60 * 1000;

const DEFAULT_MAX_CONTEXT = 5;
const SAME_CHANNEL_WINDOW_MS = 10 * MINUTE_MS;

function sentAtMs(message: IncomingMessage): number {
  return Date.parse(message.sentAt);
}

/** Messages that can be context: not the message itself and not sent after it. */
function priorMessages(msg: IncomingMessage, history: IncomingMessage[]): IncomingMessage[] {
  const msgTime = sentAtMs(msg);
  return history.filter((m) => {
    if (m.externalId === msg.externalId) return false;
    const time = sentAtMs(m);
    return Number.isNaN(msgTime) || Number.isNaN(time) || time <= msgTime;
  });
}

/** Walks `replyToExternalId` links upwards from `msg`, nearest parent first. Cycle-safe. */
function replyChain(msg: IncomingMessage, candidates: IncomingMessage[]): IncomingMessage[] {
  const byId = new Map(candidates.map((m) => [m.externalId, m]));
  const chain: IncomingMessage[] = [];
  const seen = new Set<string>([msg.externalId]);

  let parentId = msg.replyToExternalId;
  while (parentId && !seen.has(parentId)) {
    seen.add(parentId);
    const parent = byId.get(parentId);
    if (!parent) break;
    chain.push(parent);
    parentId = parent.replyToExternalId;
  }
  return chain;
}

function sameThread(msg: IncomingMessage, candidates: IncomingMessage[]): IncomingMessage[] {
  if (!msg.threadId) return [];
  return candidates.filter((m) => m.threadId === msg.threadId);
}

function sameChannelNearby(msg: IncomingMessage, candidates: IncomingMessage[]): IncomingMessage[] {
  if (!msg.channelId) return [];
  const msgTime = sentAtMs(msg);
  if (Number.isNaN(msgTime)) return [];

  return candidates.filter((m) => {
    if (m.channelId !== msg.channelId) return false;
    const time = sentAtMs(m);
    return !Number.isNaN(time) && msgTime - time <= SAME_CHANNEL_WINDOW_MS;
  });
}

/** Most recent first; unparseable timestamps sort last. */
function newestFirst(messages: IncomingMessage[]): IncomingMessage[] {
  return [...messages].sort((a, b) => {
    const at = sentAtMs(a);
    const bt = sentAtMs(b);
    if (Number.isNaN(at) || Number.isNaN(bt)) return Number.isNaN(at) ? 1 : -1;
    return bt - at;
  });
}

/**
 * Picks up to `max` earlier messages that give `msg` its conversational context.
 *
 * Selection priority: same thread, then the reply chain, then same-channel messages from the
 * ten minutes before `msg`. Within a tier the most recent messages win. The result is returned
 * oldest first so it reads like the chat did. `msg` itself and anything sent after it are never
 * included, and each message appears at most once.
 */
export function buildContext(
  msg: IncomingMessage,
  history: IncomingMessage[],
  max: number = DEFAULT_MAX_CONTEXT,
): IncomingMessage[] {
  if (max <= 0) return [];

  const candidates = priorMessages(msg, history);
  const tiers = [
    newestFirst(sameThread(msg, candidates)),
    replyChain(msg, candidates),
    newestFirst(sameChannelNearby(msg, candidates)),
  ];

  const picked = new Map<string, IncomingMessage>();
  for (const tier of tiers) {
    for (const m of tier) {
      if (picked.size >= max) break;
      if (!picked.has(m.externalId)) picked.set(m.externalId, m);
    }
  }

  return [...picked.values()].sort((a, b) => {
    const diff = sentAtMs(a) - sentAtMs(b);
    return Number.isNaN(diff) ? 0 : diff;
  });
}
