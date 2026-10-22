import { formatPostBack } from '@clerk/core';
import { postDiscordMessage } from '../../../../../lib/discord-rest';
import { postApprovedItem } from './post-item';
import { createSupabasePostStoreFromEnv, DEMO_COMMUNITY_ID, isItemId } from './store';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

type RouteContext = { params: { id: string } | Promise<{ id: string }> };

/** POST /api/items/:id/post — body `{ actor }`. 409 unless the item is approved. */
export async function POST(request: Request, context: RouteContext): Promise<Response> {
  const { id } = await Promise.resolve(context.params);
  if (!isItemId(id)) return Response.json({ error: 'Item not found' }, { status: 404 });

  const actor = await readActor(request);
  const origin = originOf(request);
  const outcome = await postApprovedItem({
    itemId: id,
    actor,
    origin,
    store: createSupabasePostStoreFromEnv(),
    discord: { postMessage: postDiscordMessage },
    formatPostBack,
    demoCommunityId: process.env.DEMO_COMMUNITY_ID || DEMO_COMMUNITY_ID,
    discordToken: process.env.DISCORD_BOT_TOKEN,
  });

  return Response.json(outcome.body, {
    status: outcome.status,
    headers: { 'cache-control': 'no-store' },
  });
}

async function readActor(request: Request): Promise<unknown> {
  try {
    const body = (await request.json()) as { actor?: unknown };
    return body?.actor;
  } catch {
    return undefined;
  }
}

function originOf(request: Request): string | undefined {
  try {
    return new URL(request.url).origin;
  } catch {
    return undefined;
  }
}
