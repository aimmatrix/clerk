import type { ExtractedItem, Priority } from '@clerk/core';

const BASE: Record<Priority, number> = { P0: 70, P1: 50, P2: 30, P3: 10 };
const HOUR = 3_600_000;

/**
 * Offline stand-in for C10's rankUrgency (same formula as the PRD) so cached items sort
 * sensibly without the API. `now` is the simulated message time, not the wall clock.
 */
export function localUrgency(item: ExtractedItem, now: Date): number {
  let score = BASE[item.priority];

  if (item.due_at) {
    const delta = new Date(item.due_at).getTime() - now.getTime();
    if (Number.isNaN(delta)) score += 0;
    else if (delta < 0) score += 30;
    else if (delta <= 24 * HOUR) score += 25;
    else if (delta <= 72 * HOUR) score += 15;
  }

  if (item.type === 'request') score += 5;
  if (/\b(urgent|asap|tonight)\b/i.test(`${item.title} ${item.summary}`)) score += 10;

  return Math.min(100, Math.max(0, Math.round(score)));
}
