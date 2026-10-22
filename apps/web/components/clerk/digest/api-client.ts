import type { Digest } from '@clerk/core';

export const DEMO_COMMUNITY = '00000000-0000-0000-0000-000000000001';

export class DigestApiError extends Error {
  constructor(message: string, readonly status?: number) {
    super(message);
    this.name = 'DigestApiError';
  }
}

/** GET /api/digest?communityId=… (contract). */
export async function fetchDigest(communityId: string, signal?: AbortSignal): Promise<Digest> {
  const res = await fetch(`/api/digest?communityId=${encodeURIComponent(communityId)}`, {
    signal,
    cache: 'no-store',
  });
  if (!res.ok) throw new DigestApiError(`Digest request failed (${res.status})`, res.status);
  const body = (await res.json()) as Digest;
  // Defensive: tolerate a partially-populated payload rather than crashing the page.
  return {
    generatedAt: body.generatedAt ?? new Date().toISOString(),
    open: body.open ?? [],
    overdue: body.overdue ?? [],
    unansweredQuestions: body.unansweredQuestions ?? [],
    decisions: body.decisions ?? [],
    stats: body.stats ?? { captured: 0, pending: 0, approved: 0, failures: 0, hoursSaved: 0 },
  };
}

export interface PostDigestResult {
  posted: boolean;
  /** True when nothing was sent to Discord (demo community). */
  simulated: boolean;
}

/** The board moved between the reviewer opening the preview and confirming. Nothing was posted. */
export class DigestChangedError extends DigestApiError {
  constructor(message: string) {
    super(message, 409);
    this.name = 'DigestChangedError';
  }
}

async function readError(res: Response, fallback: string): Promise<string> {
  try {
    const body = (await res.json()) as { error?: unknown };
    if (typeof body.error === 'string' && body.error) return body.error;
  } catch {
    // Not JSON — fall through.
  }
  return fallback;
}

/**
 * Post the digest to Discord via `POST /api/digest/post`. Only ever called
 * after the reviewer confirms in the approval dialog.
 *
 * `content` is the preview the reviewer approved and `generatedAt` is the
 * digest it was rendered from. The server posts its own rebuild only if it
 * matches, and answers 409 otherwise (surfaced as `DigestChangedError`).
 *
 * The demo community is acknowledged by the server without calling Discord. If
 * the API is unreachable there, it is simulated locally so the stage demo
 * still works offline.
 */
export async function postDigest(args: {
  communityId: string;
  content: string;
  generatedAt: string;
  actor: string;
}): Promise<PostDigestResult> {
  const demo = args.communityId === DEMO_COMMUNITY;

  let res: Response;
  try {
    res = await fetch('/api/digest/post', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(args),
    });
  } catch {
    if (demo) return simulateLocally();
    throw new DigestApiError('Could not reach the server. Check your connection and try again.');
  }

  if (res.ok) {
    const body = (await res.json().catch(() => null)) as { simulated?: boolean } | null;
    return { posted: true, simulated: Boolean(body?.simulated) };
  }
  if (res.status === 409) {
    throw new DigestChangedError(await readError(res, 'The digest changed. Review the updated version and post again.'));
  }
  if (demo && (res.status === 404 || res.status >= 500)) return simulateLocally();
  throw new DigestApiError(await readError(res, `Post failed (${res.status})`), res.status);
}

async function simulateLocally(): Promise<PostDigestResult> {
  await new Promise((r) => setTimeout(r, 450));
  return { posted: true, simulated: true };
}
