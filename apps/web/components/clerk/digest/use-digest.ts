'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import type { Digest } from '@clerk/core';
import { fetchDigest } from './api-client';
import { makeFixtureDigest } from './fixture';

export type DigestStatus = 'loading' | 'ready' | 'sample';

const OFFLINE = process.env.NEXT_PUBLIC_SIMULATOR_OFFLINE === '1';

/**
 * Loads the digest. Falls back to sample data (clearly flagged via
 * `status === 'sample'`) when offline mode is on or the API is unreachable,
 * so the page always renders on stage.
 */
export function useDigest(communityId: string) {
  const [digest, setDigest] = useState<Digest | null>(null);
  const [status, setStatus] = useState<DigestStatus>('loading');
  const [refreshing, setRefreshing] = useState(false);
  const abortRef = useRef<AbortController | null>(null);

  const load = useCallback(async () => {
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    setRefreshing(true);
    const timeout = setTimeout(() => controller.abort(), 2000);

    if (OFFLINE) {
      clearTimeout(timeout);
      setDigest(makeFixtureDigest());
      setStatus('sample');
      setRefreshing(false);
      return;
    }
    try {
      const next = await fetchDigest(communityId, controller.signal);
      setDigest(next);
      setStatus('ready');
    } catch {
      if (abortRef.current !== controller) return;
      setDigest((prev) => prev ?? makeFixtureDigest());
      setStatus((prev) => (prev === 'ready' ? 'ready' : 'sample'));
    } finally {
      clearTimeout(timeout);
      if (abortRef.current === controller) setRefreshing(false);
    }
  }, [communityId]);

  useEffect(() => {
    void load();
    return () => abortRef.current?.abort();
  }, [load]);

  return { digest, status, refreshing, refresh: load };
}
