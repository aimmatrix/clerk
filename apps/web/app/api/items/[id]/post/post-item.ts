import type { Item } from '@clerk/core';
import { DiscordRestError, type DiscordPostInput, type DiscordPostResult } from '../../../../../lib/discord-rest';
import { DEMO_COMMUNITY_ID, StoreError, type LoadedItem, type PostStore } from './store';

export type PostFailureStatus = 400 | 404 | 409 | 422 | 502 | 503;

export type PostOutcome =
  | { status: 200; body: { posted: true; text: string } }
  | { status: PostFailureStatus; body: { error: string } };

export interface PostItemInput {
  itemId: string;
  actor: unknown;
  /** Origin used to build the public .ics link on event posts. */
  origin?: string;
  store: PostStore;
  discord: {
    postMessage(input: DiscordPostInput): Promise<DiscordPostResult>;
  };
  formatPostBack: (item: Item, opts?: { now?: Date; icsUrl?: string }) => string;
  now?: Date;
  demoCommunityId?: string;
  discordToken?: string;
}

interface Target {
  channelId: string;
  replyToMessageId?: string;
}

/**
 * Posts an approved item. Anything that is not `approved` returns 409 and
 * never calls Discord. The demo community and simulator-sourced messages are
 * marked posted locally, with no Discord call.
 */
export async function postApprovedItem(input: PostItemInput): Promise<PostOutcome> {
  const actor = readActor(input.actor);
  if (!actor) return failure(400, 'An actor is required');

  const demoCommunityId = input.demoCommunityId || DEMO_COMMUNITY_ID;
  let loaded: LoadedItem | null;
  try {
    loaded = await input.store.load(input.itemId);
  } catch (err) {
    return storeFailure(err);
  }
  if (!loaded) return failure(404, 'Item not found');

  if (loaded.item.status !== 'approved') {
    return failure(409, `Only approved items can be posted (this one is ${loaded.item.status})`);
  }

  const now = input.now ?? new Date();
  const text = input.formatPostBack(loaded.item, {
    now,
    icsUrl: loaded.item.type === 'event' ? icsUrl(input.origin, loaded.item.id) : undefined,
  });
  if (!text.trim()) return failure(422, 'Nothing to post for this item');

  const simulator = isSimulator(loaded, demoCommunityId);
  let delivered: { id: string; channelId: string } | null = null;

  try {
    if (!simulator) {
      const targets = postTargets(loaded);
      if (targets.length === 0) return failure(422, 'No Discord channel is configured for this community');
      if (!input.discordToken) return failure(503, 'Discord bot token is not configured');
      delivered = await deliver(targets, text, input.discordToken, input.discord);
    }

    await input.store.markPosted(input.itemId, actor, {
      status: 'posted',
      text,
      simulator,
      ...(delivered ? { channelId: delivered.channelId, discordMessageId: delivered.id } : {}),
    });
  } catch (err) {
    if (delivered) {
      return failure(502, 'The message reached Discord, but the board could not be updated. Refresh before trying again.');
    }
    if (err instanceof DiscordRestError) return discordFailure(err);
    return storeFailure(err);
  }

  return { status: 200, body: { posted: true, text } };
}

function isSimulator(loaded: LoadedItem, demoCommunityId: string): boolean {
  return loaded.item.communityId === demoCommunityId || loaded.message?.source === 'simulator';
}

/** Reply in the source thread when we have one, otherwise the community post channel. */
function postTargets(loaded: LoadedItem): Target[] {
  const targets: Target[] = [];
  const message = loaded.message;
  if (message && message.source === 'discord' && message.externalId) {
    const channelId = message.threadId || message.channelId;
    if (channelId) targets.push({ channelId, replyToMessageId: message.externalId });
  }

  const fallback = loaded.postChannelId;
  if (fallback && !targets.some((target) => target.channelId === fallback)) {
    targets.push({ channelId: fallback });
  }
  return targets;
}

async function deliver(
  targets: Target[],
  content: string,
  token: string,
  discord: PostItemInput['discord'],
): Promise<{ id: string; channelId: string }> {
  let lastError: DiscordRestError | null = null;

  for (let i = 0; i < targets.length; i++) {
    const target = targets[i];
    try {
      const sent = await discord.postMessage({
        channelId: target.channelId,
        content,
        replyToMessageId: target.replyToMessageId,
        token,
      });
      return { id: sent.id, channelId: target.channelId };
    } catch (err) {
      if (!(err instanceof DiscordRestError)) throw err;
      lastError = err;
      const retryable = err.status === 400 || err.status === 403 || err.status === 404;
      if (!(retryable && i < targets.length - 1)) throw err;
    }
  }

  throw lastError ?? new DiscordRestError('Discord rejected the post', 502);
}

function icsUrl(origin: string | undefined, itemId: string): string | undefined {
  if (!origin) return undefined;
  const base = origin.replace(/\/$/, '');
  return `${base}/api/items/${encodeURIComponent(itemId)}/ics`;
}

function readActor(actor: unknown): string | null {
  if (typeof actor !== 'string') return null;
  const trimmed = actor.trim();
  if (!trimmed || trimmed.length > 120) return null;
  return trimmed;
}

function failure(status: PostFailureStatus, error: string): PostOutcome {
  return { status, body: { error } };
}

function storeFailure(err: unknown): PostOutcome {
  if (err instanceof StoreError) {
    if (err.status === 404) return failure(404, err.message);
    if (err.status === 409) return failure(409, err.message);
    if (err.status === 503) return failure(503, err.message);
    return failure(502, err.message);
  }
  return failure(502, 'Could not post this item');
}

function discordFailure(err: DiscordRestError): PostOutcome {
  if (err.status === 401) return failure(503, 'Discord rejected the bot token');
  if (err.status === 403) return failure(502, 'Clerk cannot send messages in that channel');
  if (err.status === 404) return failure(502, 'That Discord channel was not found');
  if (err.status === 429) return failure(502, 'Discord is rate limiting posts. Try again in a moment');
  return failure(502, 'Discord rejected the post');
}
