import { timingSafeEqual } from 'crypto';
import { DEMO_COMMUNITY_ID } from '../_mock-core';

function secretsEqual(left: string, right: string): boolean {
  const a = Buffer.from(left);
  const b = Buffer.from(right);
  if (a.length !== b.length) {
    timingSafeEqual(a, a);
    return false;
  }
  return timingSafeEqual(a, b);
}

/**
 * POST /api/ingest requires `x-clerk-secret: $INGEST_SECRET` when the env var is set.
 * When it is unset (local demo before X1 env), the simulator may ingest into the demo
 * community without a header so `/simulator` works. Any other community is refused.
 */
export function authorizeIngest(req: Request, source: string, communityId: string): boolean {
  const expected = process.env.INGEST_SECRET?.trim();
  const got = req.headers.get('x-clerk-secret') ?? '';
  // The public demo accepts same-origin simulated chat only; the server secret stays private.
  if (source === 'simulator' && communityId === DEMO_COMMUNITY_ID && req.headers.get('origin') === new URL(req.url).origin) return true;
  if (expected) return secretsEqual(got, expected);
  return source === 'simulator' && communityId === DEMO_COMMUNITY_ID;
}
