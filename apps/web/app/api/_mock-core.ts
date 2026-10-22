// Compatibility entry point for API parsers; extraction, ranking and digest use the shared core.
export * from '@clerk/core';
export const ITEM_TYPES = ['request', 'task', 'event', 'question', 'decision', 'noise'] as const;
export const PRIORITIES = ['P0', 'P1', 'P2', 'P3'] as const;
export const REVIEW_ACTIONS = ['approve', 'edit', 'reassign', 'reject', 'done'] as const;

/** Check provider connectivity without treating rejected credentials as healthy. */
export async function probeLlm(timeoutMs = 2500): Promise<boolean> {
  const base = (process.env.LLM_BASE_URL ?? 'https://api.openai.com/v1').replace(/\/+$/, '');
  const key = process.env.LLM_API_KEY?.trim();
  if (!key && !/localhost|127\.0\.0\.1/.test(base)) return false;
  try {
    const response = await fetch(`${base}/models`, {
      headers: key ? { authorization: `Bearer ${key}` } : {},
      signal: AbortSignal.timeout(timeoutMs),
    });
    return response.ok;
  } catch { return false; }
}
