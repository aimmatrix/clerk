import { canExportIcs, toIcs } from '@clerk/core';
import { renderItemIcs } from './ics-item';
import { createSupabasePostStoreFromEnv, isItemId } from '../post/store';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

type RouteContext = { params: { id: string } | Promise<{ id: string }> };

/** GET /api/items/:id/ics — `text/calendar` for an item that has a start time. */
export async function GET(_request: Request, context: RouteContext): Promise<Response> {
  const { id } = await Promise.resolve(context.params);
  if (!isItemId(id)) return Response.json({ error: 'Item not found' }, { status: 404 });

  const result = await renderItemIcs({
    itemId: id,
    store: createSupabasePostStoreFromEnv(),
    canExportIcs,
    toIcs,
  });

  if (result.status !== 200) return Response.json(result.body, { status: result.status });

  return new Response(result.body, {
    status: 200,
    headers: {
      'content-type': 'text/calendar; charset=utf-8',
      'content-disposition': `attachment; filename="${result.filename}"`,
      'cache-control': 'private, max-age=60',
    },
  });
}
