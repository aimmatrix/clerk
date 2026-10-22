/**
 * Clerk smoke test.
 *
 * Default (offline): boots a PostgREST stand-in and an LLM stub, then calls the
 * real route handlers. Flow: health → ingest 3 messages → items appear →
 * reject a post that is not approved → approve → post → digest.
 *
 * Live: `SMOKE_HTTP=1` talks to `CLERK_API_URL` (default http://localhost:3000)
 * using the environment you already exported. That path needs Supabase and an LLM.
 */
import { DEMO_COMMUNITY_ID } from '@clerk/core';
import { startFakeSupabase } from './fake-supabase';
import { startLlmStub } from './llm-stub';

const DEMO = process.env.DEMO_COMMUNITY_ID || DEMO_COMMUNITY_ID;
const SECRET = process.env.INGEST_SECRET || 'smoke-secret';

interface Item {
  id: string;
  type: string;
  title: string;
  status: string;
  ownerName: string | null;
}

async function main(): Promise<void> {
  if (process.env.SMOKE_HTTP === '1') {
    const base = (process.env.CLERK_API_URL || 'http://localhost:3000').replace(/\/$/, '');
    await runFlow((path, init) => fetch(`${base}${path}`, init));
    return;
  }
  await runInProcess();
}

async function runInProcess(): Promise<void> {
  const db = await startFakeSupabase((tables) => {
    tables.get('communities')?.push({
      id: DEMO,
      name: 'Shoreditch Builders (Demo)',
      discord_guild_id: null,
      post_channel_id: null,
      owner_user_id: null,
      created_at: new Date().toISOString(),
    });
  });
  const llm = await startLlmStub();

  process.env.NEXT_PUBLIC_SUPABASE_URL = db.url;
  process.env.SUPABASE_URL = db.url;
  process.env.SUPABASE_SERVICE_ROLE_KEY = 'smoke-service-key';
  process.env.LLM_BASE_URL = llm.url;
  process.env.LLM_API_KEY = 'smoke-llm';
  process.env.LLM_MODEL = 'smoke';
  process.env.INGEST_SECRET = SECRET;
  process.env.DEMO_COMMUNITY_ID = DEMO;
  process.env.CONFIDENCE_THRESHOLD = '0.6';
  delete process.env.DISCORD_BOT_TOKEN;

  const { resetSupabaseService } = await import('../apps/web/lib/supabase-server');
  resetSupabaseService();

  const health = await import('../apps/web/app/api/health/route');
  const ingest = await import('../apps/web/app/api/ingest/route');
  const items = await import('../apps/web/app/api/items/route');
  const review = await import('../apps/web/app/api/items/[id]/route');
  const post = await import('../apps/web/app/api/items/[id]/post/route');
  const digest = await import('../apps/web/app/api/digest/route');

  const call = async (path: string, init?: RequestInit) => {
    const request = new Request(`http://127.0.0.1${path}`, init);
    const [pathname] = path.split('?');
    if (pathname === '/api/health') return health.GET();
    if (pathname === '/api/ingest') return ingest.POST(request);
    if (pathname === '/api/items') return items.GET(request);
    if (pathname === '/api/digest') return digest.GET(request);
    const itemMatch = pathname.match(/^\/api\/items\/([^/]+)$/);
    if (itemMatch && (init?.method ?? 'GET') === 'PATCH') {
      return review.PATCH(request, { params: { id: decodeURIComponent(itemMatch[1]) } });
    }
    const postMatch = pathname.match(/^\/api\/items\/([^/]+)\/post$/);
    if (postMatch) return post.POST(request, { params: { id: decodeURIComponent(postMatch[1]) } });
    throw new Error(`smoke has no route for ${path}`);
  };

  try {
    await runFlow(call);
  } finally {
    await db.close();
    await llm.close();
  }
}

async function runFlow(call: (path: string, init?: RequestInit) => Promise<Response>): Promise<void> {
  const health = await json<{ ok: boolean; llm: boolean; db: boolean }>(call, '/api/health');
  assert(health.db, `health.db should be true, got ${JSON.stringify(health)}`);
  assert(health.llm, `health.llm should be true, got ${JSON.stringify(health)}`);
  assert(health.ok, `health.ok should be true, got ${JSON.stringify(health)}`);
  step('health', health);

  const messages = [
    {
      externalId: 'smoke-venue',
      authorName: 'Priya',
      content: 'Urgent: we need a venue for 60 people in Shoreditch tonight.',
      sentAt: new Date().toISOString(),
      source: 'simulator' as const,
    },
    {
      externalId: 'smoke-pizza',
      authorName: 'Ana',
      content: "I'll grab the pizza for Thursday — leave it with Ana.",
      sentAt: new Date().toISOString(),
      source: 'simulator' as const,
    },
    {
      externalId: 'smoke-access',
      authorName: 'Sam',
      content: 'Is there step-free access at the venue?',
      sentAt: new Date().toISOString(),
      source: 'simulator' as const,
    },
  ];

  for (const message of messages) {
    const ingested = await json<{ messageId: string; items: Item[]; failures: unknown[] }>(call, '/api/ingest', {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-clerk-secret': SECRET },
      body: JSON.stringify({ communityId: DEMO, message, context: [] }),
    });
    assert(ingested.items.length >= 1, `ingest produced no items for "${message.content}"`);
    step('ingest', { externalId: message.externalId, items: ingested.items.map((item) => item.title) });
  }

  const listed = await json<{ items: Item[] }>(call, `/api/items?communityId=${DEMO}`);
  const actionable = listed.items.filter((item) => item.type !== 'noise' && item.status === 'pending');
  assert(actionable.length >= 3, `expected at least 3 pending items, got ${listed.items.length}`);
  step('items', { count: actionable.length, titles: actionable.map((item) => item.title) });

  const target = actionable.find((item) => item.ownerName === 'Ana') ?? actionable[0];
  const blocked = await call(`/api/items/${target.id}/post`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ actor: 'smoke' }),
  });
  assert(blocked.status === 409, `posting a pending item should be 409, got ${blocked.status}`);
  step('post blocked', { status: blocked.status });

  const approved = await json<{ item: Item }>(call, `/api/items/${target.id}`, {
    method: 'PATCH',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ action: 'approve', actor: 'smoke' }),
  });
  assert(approved.item.status === 'approved', `approve left status ${approved.item.status}`);
  step('approve', { id: approved.item.id, title: approved.item.title });

  const posted = await json<{ posted: true; text: string }>(call, `/api/items/${target.id}/post`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ actor: 'smoke' }),
  });
  assert(posted.posted === true, 'post did not return posted: true');
  assert(posted.text.includes('Ana'), `post-back should name Ana, got ${posted.text}`);
  step('post', { text: posted.text });

  const digest = await json<{
    stats: { captured: number; pending: number; approved: number; failures: number; hoursSaved: number };
    open: Item[];
  }>(call, `/api/digest?communityId=${DEMO}`);
  assert(digest.stats.captured >= 3, `digest captured ${digest.stats.captured}`);
  assert(digest.stats.approved >= 1, 'digest should count the approved post');
  step('digest', digest.stats);

  console.log('\nsmoke green');
}

async function json<T>(
  call: (path: string, init?: RequestInit) => Promise<Response>,
  path: string,
  init?: RequestInit,
): Promise<T> {
  const response = await call(path, init);
  const body = (await response.json().catch(() => null)) as T & { error?: string };
  if (!response.ok) {
    throw new Error(`${init?.method ?? 'GET'} ${path} → ${response.status} ${JSON.stringify(body)}`);
  }
  return body;
}

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

function step(name: string, detail: unknown): void {
  console.log(`ok  ${name}  ${JSON.stringify(detail)}`);
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
