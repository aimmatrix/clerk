import type { Failure } from './types';

export class ClaimError extends Error {}

/**
 * POST /api/failures/:id/claim  { actor }  →  { failure }
 * Pass `offline: true` when running against the mock feed, so the demo never needs the API.
 */
export async function claimFailure(
  id: string,
  actor: string,
  opts: { offline?: boolean } = {},
): Promise<Pick<Failure, 'id' | 'claimedBy'>> {
  if (opts.offline) {
    await new Promise((resolve) => setTimeout(resolve, 350));
    return { id, claimedBy: actor };
  }

  let res: Response;
  try {
    res = await fetch(`/api/failures/${encodeURIComponent(id)}/claim`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ actor }),
    });
  } catch {
    throw new ClaimError('Couldn’t reach Clerk. Check your connection and try again.');
  }

  if (!res.ok) throw new ClaimError(`Couldn’t claim this one (${res.status}). Try again.`);

  const body = (await res.json().catch(() => null)) as { failure?: Partial<Failure> } | null;
  return { id, claimedBy: body?.failure?.claimedBy ?? actor };
}
