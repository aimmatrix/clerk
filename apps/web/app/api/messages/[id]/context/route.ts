import { buildContext } from '@clerk/core';
import { getSupabaseService } from '@/lib/supabase-server';
import { rowToMessage, type MessageRow } from '@/lib/db';
import { isUuid, jsonError, jsonOk } from '../../../_lib/http';

export const dynamic = 'force-dynamic';

export async function GET(req: Request, { params }: { params: { id: string } }) {
  const communityId = new URL(req.url).searchParams.get('communityId') ?? '';
  if (!isUuid(params.id) || !isUuid(communityId)) return jsonError('Valid message and community IDs are required.', 400);
  const db = getSupabaseService();
  if (!db) return jsonError('Database is not configured.', 503);
  const target = await db.from('messages').select('*').eq('id', params.id).eq('community_id', communityId).maybeSingle();
  if (target.error) return jsonError('Could not load source message.', 503);
  if (!target.data) return jsonError('Message not found.', 404);
  const message = rowToMessage(target.data as MessageRow);
  let query = db.from('messages').select('*').eq('community_id', communityId).neq('id', params.id).lte('sent_at', message.sentAt);
  if (message.channelId) query = query.eq('channel_id', message.channelId);
  const history = await query.order('sent_at', { ascending: false }).limit(30);
  if (history.error) return jsonError('Could not load message context.', 503);
  const incoming = (row: ReturnType<typeof rowToMessage>) => ({ ...row, channelId: row.channelId ?? undefined, threadId: row.threadId ?? undefined, replyToExternalId: row.replyToExternalId ?? undefined, authorExternalId: row.authorExternalId ?? undefined, permalink: row.permalink ?? undefined });
  return jsonOk({ message, context: buildContext(incoming(message), (history.data ?? []).map(row => incoming(rowToMessage(row as MessageRow)))) });
}
