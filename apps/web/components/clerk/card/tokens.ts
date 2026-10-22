import type { ItemType, Priority } from '@clerk/core';

/** Light-theme colours, kept local so the card has no dependency on CSS vars. */
/** Types are told apart by label, not colour: one neutral ink for all. */
export const TYPE_COLOURS: Record<ItemType, string> = {
  request: '#52525B',
  task: '#52525B',
  event: '#52525B',
  question: '#52525B',
  decision: '#52525B',
  noise: '#A1A1AA',
};

export const TYPE_LABELS: Record<ItemType, string> = {
  request: 'Request',
  task: 'Task',
  event: 'Event',
  question: 'Question',
  decision: 'Decision',
  noise: 'Noise',
};

/** Only P0 gets colour; lower priorities step down in weight. */
export const PRIORITY_COLOURS: Record<Priority, string> = {
  P0: '#C2410C',
  P1: '#18181B',
  P2: '#52525B',
  P3: '#71717A',
};

export const SUCCESS_COLOUR = '#15803D';
export const URGENT_COLOUR = '#C2410C';
export const WARNING_COLOUR = '#B45309';

/** Neutral grey unless confidence is low (those items normally route to the failure log). */
export function confidenceColour(confidence: number): string {
  if (confidence >= 0.8) return '#52525B';
  if (confidence >= 0.6) return WARNING_COLOUR;
  return URGENT_COLOUR;
}

/** Shared spring for fly-in and layout moves (brief: stiffness 260, damping 24, under 600ms). */
export const CARD_SPRING = { type: 'spring', stiffness: 260, damping: 24 } as const;
