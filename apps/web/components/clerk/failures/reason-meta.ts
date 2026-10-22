import type { FailureReason } from './types';

export interface ReasonMeta {
  label: string;
  /** Plain-English explanation shown in the expanded row and as a tooltip. */
  hint: string;
  /** Hex colour from the Clerk design tokens. */
  colour: string;
}

export const REASON_META: Record<FailureReason, ReasonMeta> = {
  low_confidence: {
    label: 'Low confidence',
    hint: 'Clerk wasn’t sure enough to turn this into a card, so it didn’t guess.',
    colour: '#F59E0B',
  },
  ambiguous_owner: {
    label: 'Unclear owner',
    hint: 'There was a task here, but nobody was clearly named, so Clerk left the owner for you.',
    colour: '#60A5FA',
  },
  invalid_json: {
    label: 'Unreadable answer',
    hint: 'The model’s answer wasn’t valid structured output, even after one retry.',
    colour: '#7C5CFF',
  },
  llm_error: {
    label: 'Model unavailable',
    hint: 'The language model didn’t respond, so this message was never analysed.',
    colour: '#F43F5E',
  },
  unsupported: {
    label: 'Not supported',
    hint: 'Clerk can’t read this kind of message yet (for example, another language or an attachment).',
    colour: '#8A90A6',
  },
};

export const REASON_ORDER: FailureReason[] = [
  'low_confidence',
  'ambiguous_owner',
  'invalid_json',
  'llm_error',
  'unsupported',
];

/** Green ≥ 0.8, amber 0.6–0.8, red < 0.6 — matches the confidence ring on item cards. */
export function confidenceColour(confidence: number): string {
  if (confidence >= 0.8) return '#34D399';
  if (confidence >= 0.6) return '#F59E0B';
  return '#F43F5E';
}
