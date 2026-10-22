import type { Item, ItemStatus, ItemType } from '@clerk/core';

export type ColumnId = 'inbox' | 'approved' | 'posted' | 'done';

export interface ColumnDef {
  id: ColumnId;
  title: string;
  hint: string;
  accent: string;
  status: ItemStatus;
  empty: string;
}

/** Board columns, left to right. Each maps to exactly one item status; `rejected` is never shown. */
export const COLUMNS: readonly ColumnDef[] = [
  {
    id: 'inbox',
    title: 'Inbox',
    hint: 'Needs review',
    accent: '#F59E0B',
    status: 'pending',
    empty: 'Inbox zero. Nothing needs your eyes.',
  },
  {
    id: 'approved',
    title: 'Approved',
    hint: 'Ready to post',
    accent: '#7C5CFF',
    status: 'approved',
    empty: 'Nothing approved and waiting.',
  },
  {
    id: 'posted',
    title: 'Posted',
    hint: 'Sent to the community',
    accent: '#22D3EE',
    status: 'posted',
    empty: 'Nothing posted yet. Approved items land here once sent.',
  },
  {
    id: 'done',
    title: 'Done',
    hint: 'Closed out',
    accent: '#34D399',
    status: 'done',
    empty: 'No finished work yet.',
  },
];

/** Types a lead can filter by. Noise is stored by the pipeline but never shown on the board. */
export const FILTERABLE_TYPES: readonly ItemType[] = ['request', 'task', 'event', 'question', 'decision'];

export type TypeFilter = ItemType | 'all';

/** Items the board is allowed to show: not rejected, not noise. */
export function isBoardVisible(item: Item): boolean {
  return item.status !== 'rejected' && item.type !== 'noise';
}

/** Highest urgency first; newest activity breaks ties so ordering is stable between renders. */
export function byUrgency(a: Item, b: Item): number {
  if (b.urgencyScore !== a.urgencyScore) return b.urgencyScore - a.urgencyScore;
  const updated = Date.parse(b.updatedAt) - Date.parse(a.updatedAt);
  if (Number.isFinite(updated) && updated !== 0) return updated;
  return a.id.localeCompare(b.id);
}

export function groupByColumn(items: readonly Item[], filter: TypeFilter): Record<ColumnId, Item[]> {
  const grouped: Record<ColumnId, Item[]> = { inbox: [], approved: [], posted: [], done: [] };
  for (const item of items) {
    if (!isBoardVisible(item)) continue;
    if (filter !== 'all' && item.type !== filter) continue;
    const column = COLUMNS.find((c) => c.status === item.status);
    if (column) grouped[column.id].push(item);
  }
  for (const id of Object.keys(grouped) as ColumnId[]) grouped[id].sort(byUrgency);
  return grouped;
}

export function countByType(items: readonly Item[]): Record<TypeFilter, number> {
  const counts: Record<TypeFilter, number> = {
    all: 0,
    request: 0,
    task: 0,
    event: 0,
    question: 0,
    decision: 0,
    noise: 0,
  };
  for (const item of items) {
    if (!isBoardVisible(item)) continue;
    counts.all += 1;
    counts[item.type] += 1;
  }
  return counts;
}
