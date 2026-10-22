/**
 * Local mirror of the shared contract types (packages/core/src/types.ts, owned by C15).
 * Kept verbatim so it can be swapped for `import type { Failure, FailureReason } from '@clerk/core'`
 * with no other change once the core barrel has landed.
 */
export type FailureReason =
  | 'low_confidence'
  | 'invalid_json'
  | 'llm_error'
  | 'ambiguous_owner'
  | 'unsupported';

export interface Failure {
  id: string;
  communityId: string;
  messageId: string | null;
  reason: FailureReason;
  confidence: number | null;
  raw: unknown;
  claimedBy: string | null;
  createdAt: string;
  messageContent?: string;
  authorName?: string;
}

export const CONFIDENCE_THRESHOLD = 0.6;
export const DEMO_COMMUNITY_ID = '00000000-0000-0000-0000-000000000001';
