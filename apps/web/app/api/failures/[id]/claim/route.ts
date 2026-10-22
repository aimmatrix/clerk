import { fromStoreError, isUuid, jsonError, jsonOk, readJson } from '../../../_lib/http';
import { claimFailure } from '../../../_lib/store';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req: Request, { params }: { params: { id: string } }) {
  if (!isUuid(params.id)) return jsonError('Failure id must be a UUID.', 400);
  const body = (await readJson(req)) as { actor?: unknown } | null;
  const actor = typeof body?.actor === 'string' ? body.actor.trim() : '';
  if (!actor) return jsonError('actor is required.', 400);

  try {
    const failure = await claimFailure(params.id, actor);
    return jsonOk({ failure });
  } catch (error) {
    return fromStoreError(error);
  }
}
