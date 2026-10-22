'use client';

import { useFailures } from '@/lib/realtime';
import type { Failure } from './types';

export interface FailureFeed {
  failures: Failure[];
  loading: boolean;
  error: string | null;
  /** 'live' = Supabase realtime (C14); 'mock' = local fixtures, shown honestly in the UI. */
  source: 'live' | 'mock';
}

export function useFailureFeed(communityId: string): FailureFeed {
  return fromRealtime(useFailures(communityId));
}

type RealtimeResult = Failure[] | { failures: Failure[]; loading?: boolean; error?: unknown };

export function fromRealtime(result: RealtimeResult): FailureFeed {
  if (Array.isArray(result)) return { failures: result, loading: false, error: null, source: 'live' };
  return {
    failures: result.failures,
    loading: result.loading ?? false,
    error: result.error ? String(result.error) : null,
    source: 'live',
  };
}
