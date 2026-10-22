'use client';

import { useItems } from '@/lib/realtime';
import type { BoardItemsResult } from './types';

/** The board's data source: C14's realtime feed (initial REST fetch, then Supabase channel, polling fallback). */
export function useBoardItems(communityId: string): BoardItemsResult {
  const { items, loading, error, status, insertCount } = useItems(communityId);
  return { items, loading, error, status, insertCount };
}

export type { BoardItemsResult };
