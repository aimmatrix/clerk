import type { Digest } from '@clerk/core';
import { digestToDiscordMarkdown } from '../../../../components/clerk/digest/markdown';
import { getSupabaseService } from '../../../../lib/supabase-server';
import { postDiscordMessage } from '../../../../lib/discord-rest';
import { StoreError } from '../../_lib/http';
import { GET as getDigest } from '../route';
import { createMemoryThrottle, DEMO_COMMUNITY_ID, postDigest } from './digest-post';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const throttle = createMemoryThrottle();

/**
 * POST /api/digest/post — body `{ communityId, actor, content, generatedAt }`.
 * `content` is the preview the reviewer approved; the server posts its own
 * rebuild only when it matches (409 `digest_changed` otherwise).
 */
export async function POST(request: Request): Promise<Response> {
  const body = await request.json().catch(() => null);

  const outcome = await postDigest({
    body,
    loadDigest,
    loadCommunity,
    toMarkdown: digestToDiscordMarkdown,
    discord: { postMessage: postDiscordMessage },
    throttle,
    discordToken: process.env.DISCORD_BOT_TOKEN,
    demoCommunityId: process.env.DEMO_COMMUNITY_ID || DEMO_COMMUNITY_ID,
  });

  return Response.json(outcome.body, {
    status: outcome.status,
    headers: { 'cache-control': 'no-store' },
  });
}

/** Reuses the GET /api/digest handler so the posted text can never drift from what the board shows. */
async function loadDigest(communityId: string): Promise<Digest | null> {
  const res = await getDigest(new Request(`http://internal/api/digest?communityId=${encodeURIComponent(communityId)}`));
  if (res.status === 404) return null;
  if (!res.ok) throw new StoreError('Could not load the digest', res.status);
  return (await res.json()) as Digest;
}

async function loadCommunity(communityId: string): Promise<{ postChannelId: string | null } | null> {
  const sb = getSupabaseService();
  if (!sb) throw new StoreError('Database is not configured', 503);
  const { data, error } = await sb
    .from('communities')
    .select('post_channel_id')
    .eq('id', communityId)
    .maybeSingle();
  if (error) throw new StoreError('Could not look up that community', 502);
  if (!data) return null;
  return { postChannelId: (data.post_channel_id as string | null) ?? null };
}
