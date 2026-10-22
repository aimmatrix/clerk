import type { Digest } from '@clerk/core';
import { DiscordRestError, type DiscordPostInput, type DiscordPostResult } from '../../../../lib/discord-rest';

/** Contract demo community. Simulator digests never leave the process. */
export const DEMO_COMMUNITY_ID = '00000000-0000-0000-0000-000000000001';

/** Minimum gap between two real digest posts for one community. */
export const POST_COOLDOWN_MS = 60_000;

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export type DigestPostFailureStatus = 400 | 404 | 409 | 422 | 429 | 502 | 503;

export type DigestPostOutcome =
  | { status: 200; body: { posted: true; simulated: boolean; text: string } }
  | { status: DigestPostFailureStatus; body: { error: string; code?: 'digest_changed'; retryAfterSeconds?: number } };

export interface CommunityTarget {
  postChannelId: string | null;
}

/** Best-effort per-community throttle. Reserve before sending, release if Discord fails. */
export interface PostThrottle {
  /** Returns 0 when reserved, otherwise the milliseconds still to wait. */
  reserve(communityId: string, now: number): number;
  release(communityId: string): void;
}

export function createMemoryThrottle(cooldownMs: number = POST_COOLDOWN_MS): PostThrottle {
  const last = new Map<string, number>();
  return {
    reserve(communityId, now) {
      const previous = last.get(communityId);
      if (previous !== undefined && now - previous < cooldownMs) return cooldownMs - (now - previous);
      last.set(communityId, now);
      return 0;
    },
    release(communityId) {
      last.delete(communityId);
    },
  };
}

export interface DigestPostInput {
  /** Parsed JSON body of the request, unvalidated. */
  body: unknown;
  /** Current digest for the community, or null when the community does not exist. */
  loadDigest(communityId: string): Promise<Digest | null>;
  loadCommunity(communityId: string): Promise<CommunityTarget | null>;
  /** Pure renderer shared with the web preview, so the text matches what was approved. */
  toMarkdown(digest: Digest): string;
  discord: { postMessage(input: DiscordPostInput): Promise<DiscordPostResult> };
  throttle: PostThrottle;
  discordToken?: string;
  demoCommunityId?: string;
  now?: Date;
}

interface ParsedBody {
  communityId: string;
  actor: string;
  /** The text the reviewer approved in the dialog. */
  content: string;
  /** `generatedAt` of the digest the reviewer was looking at. */
  generatedAt: string;
}

/**
 * Posts the weekly digest to the community's Discord channel.
 *
 * Nothing the browser sends is ever posted. The route rebuilds the digest
 * itself and posts that text only if it is identical to `content`, the preview
 * the reviewer approved. If the board moved in between, it answers 409
 * `digest_changed` without calling Discord so the reviewer approves again.
 *
 * The demo community is acknowledged without any Discord call.
 */
export async function postDigest(input: DigestPostInput): Promise<DigestPostOutcome> {
  const parsed = parseBody(input.body);
  if (typeof parsed === 'string') return failure(400, parsed);

  const demoCommunityId = input.demoCommunityId || DEMO_COMMUNITY_ID;
  const simulated = parsed.communityId.toLowerCase() === demoCommunityId.toLowerCase();
  const nowMs = (input.now ?? new Date()).getTime();

  let digest: Digest | null;
  try {
    digest = await input.loadDigest(parsed.communityId);
  } catch (err) {
    return storeFailure(err);
  }
  if (!digest) return failure(404, 'That community does not exist');

  // Render with the preview's timestamp so the header line compares equal.
  const text = input.toMarkdown({ ...digest, generatedAt: parsed.generatedAt }).trim();
  if (!text) return failure(422, 'Nothing to post');

  if (text !== parsed.content.trim()) {
    return {
      status: 409,
      body: { error: 'The digest changed since you opened it. Review the updated version and post again.', code: 'digest_changed' },
    };
  }

  if (simulated) return { status: 200, body: { posted: true, simulated: true, text } };

  let target: CommunityTarget | null;
  try {
    target = await input.loadCommunity(parsed.communityId);
  } catch (err) {
    return storeFailure(err);
  }
  if (!target) return failure(404, 'That community does not exist');
  if (!target.postChannelId) return failure(422, 'No Discord channel is configured for this community');
  if (!input.discordToken) return failure(503, 'Discord bot token is not configured');

  const wait = input.throttle.reserve(parsed.communityId, nowMs);
  if (wait > 0) {
    const seconds = Math.ceil(wait / 1000);
    return {
      status: 429,
      body: { error: `A digest was posted a moment ago. Try again in ${seconds}s.`, retryAfterSeconds: seconds },
    };
  }

  try {
    await input.discord.postMessage({
      channelId: target.postChannelId,
      content: text,
      token: input.discordToken,
    });
  } catch (err) {
    input.throttle.release(parsed.communityId);
    if (err instanceof DiscordRestError) return discordFailure(err);
    return failure(502, 'Could not post the digest');
  }

  return { status: 200, body: { posted: true, simulated: false, text } };
}

function parseBody(body: unknown): ParsedBody | string {
  if (!body || typeof body !== 'object') return 'A JSON body is required';
  const { communityId, actor, content, generatedAt } = body as Record<string, unknown>;

  if (typeof communityId !== 'string' || !UUID.test(communityId)) return 'communityId must be a UUID';
  if (typeof actor !== 'string' || !actor.trim() || actor.trim().length > 120) return 'An actor is required';
  if (typeof content !== 'string' || !content.trim() || content.length > 4000) return 'content is required';
  if (typeof generatedAt !== 'string' || Number.isNaN(new Date(generatedAt).getTime())) {
    return 'generatedAt must be an ISO date';
  }
  return { communityId, actor: actor.trim(), content, generatedAt };
}

function failure(status: DigestPostFailureStatus, error: string): DigestPostOutcome {
  return { status, body: { error } };
}

function storeFailure(err: unknown): DigestPostOutcome {
  const status = err && typeof err === 'object' && 'status' in err ? Number((err as { status: unknown }).status) : 0;
  if (status === 404) return failure(404, 'That community does not exist');
  if (status === 503) return failure(503, 'Database is not configured');
  return failure(502, 'Could not load the digest');
}

function discordFailure(err: DiscordRestError): DigestPostOutcome {
  if (err.status === 401) return failure(503, 'Discord rejected the bot token');
  if (err.status === 403) return failure(502, 'Clerk cannot send messages in that channel');
  if (err.status === 404) return failure(502, 'That Discord channel was not found');
  if (err.status === 429) return failure(502, 'Discord is rate limiting posts. Try again in a moment');
  return failure(502, 'Discord rejected the post');
}
