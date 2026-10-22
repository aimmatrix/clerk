import { fromStoreError, isUuid, jsonError, jsonOk } from '../_lib/http';
import { listFailures } from '../_lib/store';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  const communityId = new URL(req.url).searchParams.get('communityId')?.trim();
  if (!communityId) return jsonError('communityId is required.', 400);
  if (!isUuid(communityId)) return jsonError('communityId must be a UUID.', 400);

  try {
    const failures = await listFailures(communityId);
    return jsonOk({ failures });
  } catch (error) {
    return fromStoreError(error);
  }
}
