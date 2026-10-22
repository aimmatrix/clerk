import type { ItemType, Priority } from '@clerk/core';

/** Design tokens from the shared brief, kept local so the card has no dependency on C1's CSS vars. */
export const TYPE_COLOURS: Record<ItemType, string> = {
  request: '#F59E0B',
  task: '#7C5CFF',
  event: '#22D3EE',
  question: '#60A5FA',
  decision: '#34D399',
  noise: '#4B5163',
};

export const TYPE_LABELS: Record<ItemType, string> = {
  request: 'Request',
  task: 'Task',
  event: 'Event',
  question: 'Question',
  decision: 'Decision',
  noise: 'Noise',
};

export const PRIORITY_COLOURS: Record<Priority, string> = {
  P0: '#F43F5E',
  P1: '#F59E0B',
  P2: '#8A90A6',
  P3: '#4B5163',
};

export const SUCCESS_COLOUR = '#34D399';
export const URGENT_COLOUR = '#F43F5E';
export const WARNING_COLOUR = '#F59E0B';

/** Green ≥ 0.8, amber 0.6–0.8, red < 0.6 (those items normally route to the failure log). */
export function confidenceColour(confidence: number): string {
  if (confidence >= 0.8) return SUCCESS_COLOUR;
  if (confidence >= 0.6) return WARNING_COLOUR;
  return URGENT_COLOUR;
}

/** Shared spring for fly-in and layout moves (brief: stiffness 260, damping 24, under 600ms). */
export const CARD_SPRING = { type: 'spring', stiffness: 260, damping: 24 } as const;
