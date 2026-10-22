import { DEMO_COMMUNITY_ID } from '@clerk/core';
import { fromStoreError, isUuid, jsonError, jsonOk, readJson } from '../../_lib/http';
import { resetSimulator } from '../../_lib/store';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  const body = (await readJson(req)) as { communityId?: unknown } | null;
  const communityId = typeof body?.communityId === 'string' ? body.communityId.trim() : '';
  if (!communityId) return jsonError('communityId is required.', 400);
  if (!isUuid(communityId)) return jsonError('communityId must be a UUID.', 400);
  if (communityId !== DEMO_COMMUNITY_ID) return jsonError('Only the demo community can be reset.', 403);

  try {
    await resetSimulator(communityId);
    return jsonOk({ ok: true as const });
  } catch (error) {
    return fromStoreError(error);
  }
}
