import { fromStoreError, isUuid, jsonError, jsonOk, readJson } from '../../_lib/http';
import { parseReviewRequest } from '../../_lib/parse';
import { applyReview, getItem } from '../../_lib/store';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(_req: Request, { params }: { params: { id: string } }) {
  if (!isUuid(params.id)) return jsonError('Item id must be a UUID.', 400);
  try {
    const item = await getItem(params.id);
    if (!item) return jsonError('Item not found.', 404);
    return jsonOk({ item });
  } catch (error) {
    return fromStoreError(error);
  }
}

export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  if (!isUuid(params.id)) return jsonError('Item id must be a UUID.', 400);
  const body = await readJson(req);
  const review = parseReviewRequest(body);
  if (!review) {
    return jsonError("Body must be { action: 'approve'|'edit'|'reassign'|'reject'|'done', actor, patch? }.", 400);
  }

  try {
    const item = await applyReview(params.id, review);
    return jsonOk({ item });
  } catch (error) {
    return fromStoreError(error);
  }
}
