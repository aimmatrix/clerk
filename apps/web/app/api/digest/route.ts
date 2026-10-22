import { buildDigest } from '../_mock-core';
import { fromStoreError, isUuid, jsonError, jsonOk } from '../_lib/http';
import { communityExists, loadDigestSource } from '../_lib/store';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  const communityId = new URL(req.url).searchParams.get('communityId')?.trim();
  if (!communityId) return jsonError('communityId is required.', 400);
  if (!isUuid(communityId)) return jsonError('communityId must be a UUID.', 400);

  try {
    const [exists, { items, failures }] = await Promise.all([
      communityExists(communityId),
      loadDigestSource(communityId),
    ]);
    if (!exists) {
      return jsonError('That community does not exist.', 404);
    }
    return jsonOk(buildDigest(items, failures));
  } catch (error) {
    return fromStoreError(error);
  }
}
