import type { Digest, IngestRequest, IngestResponse } from '@clerk/core';
import { env, log, warn } from './env';
import { mockDigest, mockHealth, mockIngest, type HealthResponse } from './mock-api';

const INGEST_TIMEOUT_MS = 12_000;
const READ_TIMEOUT_MS = 8_000;

export type ApiMode = 'live' | 'mock';
export type { HealthResponse };

let lastMode: ApiMode = env.forceMockApi ? 'mock' : 'live';

export function apiMode(): ApiMode {
  return lastMode;
}

class ClerkApiError extends Error {
  constructor(
    message: string,
    readonly status?: number,
    readonly fatal = false,
  ) {
    super(message);
    this.name = 'ClerkApiError';
  }
}

async function requestJson<T>(path: string, init: RequestInit, timeoutMs: number): Promise<T> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(`${env.clerkApiUrl}${path}`, {
      ...init,
      signal: controller.signal,
    });
    if (res.status === 401 || res.status === 403) {
      throw new ClerkApiError(`Clerk API auth failed (${res.status}) — check INGEST_SECRET.`, res.status, true);
    }
    if (!res.ok) {
      const body = await res.text().catch(() => '');
      throw new ClerkApiError(`Clerk API ${path} → ${res.status} ${body.slice(0, 180)}`, res.status);
    }
    return (await res.json()) as T;
  } finally {
    clearTimeout(timer);
  }
}

function isNetworkFailure(err: unknown): boolean {
  if (err instanceof ClerkApiError) return err.status === 404 || err.status === 501;
  if (err instanceof TypeError) return true;
  if (err instanceof Error && err.name === 'AbortError') return true;
  const code =
    (err as { cause?: { code?: string }; code?: string }).cause?.code ?? (err as { code?: string }).code;
  return code === 'ECONNREFUSED' || code === 'ENOTFOUND' || code === 'ECONNRESET';
}

export async function ingest(req: IngestRequest): Promise<{ response: IngestResponse; mode: ApiMode }> {
  if (env.forceMockApi) {
    lastMode = 'mock';
    return { response: mockIngest(req), mode: 'mock' };
  }
  try {
    const response = await requestJson<IngestResponse>(
      '/api/ingest',
      {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'x-clerk-secret': env.ingestSecret,
        },
        body: JSON.stringify(req),
      },
      INGEST_TIMEOUT_MS,
    );
    lastMode = 'live';
    return { response, mode: 'live' };
  } catch (err) {
    if (err instanceof ClerkApiError && err.fatal) throw err;
    if (isNetworkFailure(err)) {
      warn('web API not ready — ingesting via mock-api', err instanceof Error ? err.message : err);
      lastMode = 'mock';
      return { response: mockIngest(req), mode: 'mock' };
    }
    throw err;
  }
}

export async function fetchDigest(communityId: string): Promise<{ digest: Digest; mode: ApiMode }> {
  if (env.forceMockApi) {
    lastMode = 'mock';
    return { digest: mockDigest(communityId), mode: 'mock' };
  }
  try {
    const digest = await requestJson<Digest>(
      `/api/digest?communityId=${encodeURIComponent(communityId)}`,
      { method: 'GET', headers: { accept: 'application/json' } },
      READ_TIMEOUT_MS,
    );
    lastMode = 'live';
    return {
      digest: {
        generatedAt: digest.generatedAt ?? new Date().toISOString(),
        open: digest.open ?? [],
        overdue: digest.overdue ?? [],
        unansweredQuestions: digest.unansweredQuestions ?? [],
        decisions: digest.decisions ?? [],
        stats: digest.stats ?? { captured: 0, pending: 0, approved: 0, failures: 0, hoursSaved: 0 },
      },
      mode: 'live',
    };
  } catch (err) {
    if (isNetworkFailure(err)) {
      warn('web API not ready — digest via mock-api');
      lastMode = 'mock';
      return { digest: mockDigest(communityId), mode: 'mock' };
    }
    throw err;
  }
}

export async function fetchHealth(): Promise<{ health: HealthResponse; mode: ApiMode; error?: string }> {
  if (env.forceMockApi) {
    lastMode = 'mock';
    return { health: mockHealth(), mode: 'mock' };
  }
  try {
    const health = await requestJson<HealthResponse>('/api/health', { method: 'GET' }, READ_TIMEOUT_MS);
    lastMode = 'live';
    return { health, mode: 'live' };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    log(`health failed: ${message}`);
    lastMode = 'mock';
    return { health: mockHealth(), mode: 'mock', error: message };
  }
}
