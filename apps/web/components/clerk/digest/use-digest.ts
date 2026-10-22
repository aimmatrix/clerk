'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { DEMO_COMMUNITY_ID, type Digest } from '@clerk/core';
import { fetchDigest } from './api-client';
import { makeFixtureDigest } from './fixture';

export type DigestStatus = 'loading' | 'ready' | 'sample' | 'error';

const OFFLINE = process.env.NEXT_PUBLIC_SIMULATOR_OFFLINE === '1';

/**
 * Loads the digest. Falls back to sample data (clearly flagged via
 * `status === 'sample'`) for the demo community when offline or unreachable; real communities never use fixtures,
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
    const demo = communityId === DEMO_COMMUNITY_ID;
    const timeout = setTimeout(() => controller.abort(), demo ? 2000 : 10000);

    if (OFFLINE && demo) {
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
      if (demo) {
        setDigest((prev) => prev ?? makeFixtureDigest());
        setStatus((prev) => (prev === 'ready' ? 'ready' : 'sample'));
      } else {
        setStatus('error');
      }
    } finally {
      clearTimeout(timeout);
      if (abortRef.current === controller) setRefreshing(false);
    }
  }, [communityId]);

  useEffect(() => {
    setDigest(null);
    setStatus('loading');
    void load();
    return () => abortRef.current?.abort();
  }, [load]);

  return { digest, status, refreshing, refresh: load };
}
