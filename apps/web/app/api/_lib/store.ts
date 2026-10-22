import { getSupabaseService } from '../../../lib/supabase-server';
import type { SupabaseClient } from '@supabase/supabase-js';
import {
  rankUrgency,
  type ExtractedItem,
  type ExtractFailure,
  type Failure,
  type IncomingMessage,
  type Item,
  type ItemStatus,
  type ItemType,
  type ReviewAction,
  type ReviewRequest,
} from '../_mock-core';
import { itemToRow, rowToFailure, rowToItem, type FailureRow, type ItemRow } from '@/lib/db';
import { StoreError } from './http';

function service(): SupabaseClient {
  const sb = getSupabaseService();
  if (!sb) throw new StoreError('Database is not configured. Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.', 503);
  return sb;
}

function wrap(error: { message: string } | null, fallback: string, status = 500): void {
  if (error) throw new StoreError(error.message || fallback, status);
}

export async function probeDb(): Promise<boolean> {
  const sb = getSupabaseService();
  if (!sb) return false;
  const { error } = await sb.from('communities').select('id').limit(1);
  return !error;
}

export async function communityExists(communityId: string): Promise<boolean> {
  const sb = service();
  const { data, error } = await sb.from('communities').select('id').eq('id', communityId).maybeSingle();
  wrap(error, 'Could not look up that community.');
  return Boolean(data);
}

export async function upsertMessage(
  communityId: string,
  message: IncomingMessage,
): Promise<{ id: string; processed: boolean }> {
  const sb = service();
  const row = {
    community_id: communityId,
    source: message.source,
    external_id: message.externalId,
    channel_id: message.channelId ?? null,
    thread_id: message.threadId ?? null,
    reply_to_external_id: message.replyToExternalId ?? null,
    author_name: message.authorName,
    author_external_id: message.authorExternalId ?? null,
    content: message.content.slice(0, 4000),
    permalink: message.permalink ?? null,
    sent_at: message.sentAt,
    processed: false,
  };
  const { data, error } = await sb
    .from('messages')
    .upsert(row, { onConflict: 'community_id,external_id' })
    .select('id, processed')
    .single();
  wrap(error, 'Could not save that message.');
  if (!data) throw new StoreError('Could not save that message.', 500);
  return { id: data.id as string, processed: Boolean(data.processed) };
}

export async function markProcessed(messageId: string): Promise<void> {
  const sb = service();
  const { error } = await sb.from('messages').update({ processed: true }).eq('id', messageId);
  wrap(error, 'Could not mark the message as processed.');
}

function extractedToRow(
  extracted: ExtractedItem,
  communityId: string,
  messageId: string,
  sourceLink: string | null,
  now: Date,
): Omit<ItemRow, 'id' | 'created_at' | 'updated_at'> {
  return {
    community_id: communityId,
    message_id: messageId,
    type: extracted.type,
    title: extracted.title,
    summary: extracted.summary || null,
    owner_name: extracted.owner_name,
    priority: extracted.priority,
    due_at: extracted.due_at,
    confidence: extracted.confidence,
    urgency_score: rankUrgency(extracted, now),
    status: 'pending',
    suggested_reply: extracted.suggested_reply,
    event_start: extracted.event?.start ?? null,
    event_end: extracted.event?.end ?? null,
    event_location: extracted.event?.location ?? null,
    source_link: sourceLink,
  };
}

export async function replaceExtractions(args: {
  communityId: string;
  messageId: string;
  sourceLink: string | null;
  items: ExtractedItem[];
  failure?: ExtractFailure;
  now?: Date;
}): Promise<{ items: Item[]; failures: Failure[] }> {
  const sb = service();
  const now = args.now ?? new Date();

  const { error: delItems } = await sb.from('items').delete().eq('message_id', args.messageId);
  wrap(delItems, 'Could not clear previous items.');
  const { error: delFails } = await sb.from('failures').delete().eq('message_id', args.messageId);
  wrap(delFails, 'Could not clear previous failures.');

  const itemRows = args.items.map((item) =>
    extractedToRow(item, args.communityId, args.messageId, args.sourceLink, now),
  );

  let items: Item[] = [];
  if (itemRows.length) {
    const { data, error } = await sb.from('items').insert(itemRows).select('*');
    wrap(error, 'Could not save extracted items.');
    items = ((data ?? []) as ItemRow[]).map(rowToItem);
    if (items.length) {
      const events = items.map((item) => ({
        item_id: item.id,
        action: 'created',
        actor: 'clerk',
        diff: { type: item.type, title: item.title, confidence: item.confidence },
      }));
      const { error: evErr } = await sb.from('item_events').insert(events);
      wrap(evErr, 'Could not record item events.');
    }
  }

  const failures: Failure[] = [];
  if (args.failure) {
    const confidence =
      args.failure.reason === 'low_confidence' &&
      args.failure.raw &&
      typeof args.failure.raw === 'object' &&
      'confidence' in (args.failure.raw as object)
        ? Number((args.failure.raw as { confidence: number }).confidence)
        : args.items.length
          ? Math.min(...args.items.map((i) => i.confidence))
          : null;
    const { data, error } = await sb
      .from('failures')
      .insert({
        community_id: args.communityId,
        message_id: args.messageId,
        reason: args.failure.reason,
        confidence: Number.isFinite(confidence as number) ? confidence : null,
        raw: args.failure.raw ?? null,
      })
      .select('*, messages(content, author_name)')
      .single();
    wrap(error, 'Could not save the failure log entry.');
    if (data) failures.push(rowToFailure(data as FailureRow));
  }

  return { items, failures };
}

export async function listItems(
  communityId: string,
  filters: { status?: ItemStatus; type?: ItemType },
): Promise<Item[]> {
  const sb = service();
  let q = sb.from('items').select('*').eq('community_id', communityId);
  if (filters.status) q = q.eq('status', filters.status);
  if (filters.type) q = q.eq('type', filters.type);
  const { data, error } = await q.order('urgency_score', { ascending: false }).order('created_at', { ascending: false }).limit(2000);
  wrap(error, 'Could not load items.');
  return ((data ?? []) as ItemRow[]).map(rowToItem);
}

export async function getItem(id: string): Promise<Item | null> {
  const sb = service();
  const { data, error } = await sb.from('items').select('*').eq('id', id).maybeSingle();
  wrap(error, 'Could not load that item.');
  return data ? rowToItem(data as ItemRow) : null;
}

export async function applyReview(id: string, req: ReviewRequest): Promise<Item> {
  const current = await getItem(id);
  if (!current) throw new StoreError('Item not found.', 404);

  const patch: Partial<Item> = { ...(req.patch ?? {}) };
  const action: ReviewAction = req.action;
  if (action === 'approve') patch.status = 'approved';
  if (action === 'reject') patch.status = 'rejected';
  if (action === 'done') patch.status = 'done';
  if (action === 'edit' && !req.patch) throw new StoreError('Edit needs a patch.', 400);
  if (action === 'reassign' && !req.patch?.ownerName) {
    throw new StoreError('Reassign needs patch.ownerName.', 400);
  }

  const merged: Item = { ...current, ...patch };
  if (patch.priority !== undefined || patch.dueAt !== undefined || patch.type !== undefined || patch.title !== undefined) {
    patch.urgencyScore = rankUrgency(merged);
  }

  const row = itemToRow(patch);
  const sb = service();
  const { data, error } = await sb.from('items').update(row).eq('id', id).select('*').single();
  wrap(error, 'Could not update that item.');
  if (!data) throw new StoreError('Item not found.', 404);
  const updated = rowToItem(data as ItemRow);

  const { error: evErr } = await sb.from('item_events').insert({
    item_id: id,
    action: action === 'approve' ? 'approved' : action === 'reject' ? 'rejected' : action === 'done' ? 'done' : action === 'reassign' ? 'reassigned' : 'edited',
    actor: req.actor,
    diff: { patch: req.patch ?? null, before: { status: current.status, ownerName: current.ownerName, title: current.title } },
  });
  wrap(evErr, 'Could not record the review event.');

  return updated;
}

export async function listFailures(communityId: string): Promise<Failure[]> {
  const sb = service();
  const { data, error } = await sb
    .from('failures')
    .select('*, messages(content, author_name)')
    .eq('community_id', communityId)
    .order('created_at', { ascending: false })
    .limit(500);
  wrap(error, 'Could not load the failure log.');
  return ((data ?? []) as FailureRow[]).map(rowToFailure);
}

export async function claimFailure(id: string, actor: string): Promise<Failure> {
  const sb = service();
  const { data: existing, error: lookup } = await sb.from('failures').select('id').eq('id', id).maybeSingle();
  wrap(lookup, 'Could not load that failure.');
  if (!existing) throw new StoreError('Failure not found.', 404);

  const { data, error } = await sb
    .from('failures')
    .update({ claimed_by: actor })
    .eq('id', id)
    .select('*, messages(content, author_name)')
    .single();
  wrap(error, 'Could not claim that failure.');
  if (!data) throw new StoreError('Failure not found.', 404);
  return rowToFailure(data as FailureRow);
}

export async function loadDigestSource(communityId: string): Promise<{ items: Item[]; failures: Failure[] }> {
  const [items, failures] = await Promise.all([listItems(communityId, {}), listFailures(communityId)]);
  return { items, failures };
}

export async function resetSimulator(communityId: string): Promise<void> {
  const sb = service();
  const { error } = await sb.from('messages').delete().eq('community_id', communityId).eq('source', 'simulator');
  wrap(error, 'Could not reset the simulator.');
}
