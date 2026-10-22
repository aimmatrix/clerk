import { fromStoreError, isUuid, jsonError, jsonOk } from '../_lib/http';
import { isItemStatus, isItemType } from '../_lib/parse';
import { listItems } from '../_lib/store';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  const url = new URL(req.url);
  const communityId = url.searchParams.get('communityId')?.trim();
  const status = url.searchParams.get('status')?.trim();
  const type = url.searchParams.get('type')?.trim();

  if (!communityId) return jsonError('communityId is required.', 400);
  if (!isUuid(communityId)) return jsonError('communityId must be a UUID.', 400);
  if (status && !isItemStatus(status)) return jsonError('status must be pending, approved, posted, done or rejected.', 400);
  if (type && !isItemType(type)) return jsonError('type must be request, task, event, question, decision or noise.', 400);

  try {
    const items = await listItems(communityId, {
      status: status && isItemStatus(status) ? status : undefined,
      type: type && isItemType(type) ? type : undefined,
    });
    return jsonOk({ items });
  } catch (error) {
    return fromStoreError(error);
  }
}
