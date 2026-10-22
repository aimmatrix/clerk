export type ItemType = 'request' | 'task' | 'event' | 'question' | 'decision' | 'noise';
export type ItemStatus = 'pending' | 'approved' | 'posted' | 'done' | 'rejected';
export type Priority = 'P0' | 'P1' | 'P2' | 'P3';
export type FailureReason =
  | 'low_confidence'
  | 'invalid_json'
  | 'llm_error'
  | 'ambiguous_owner'
  | 'unsupported';

export interface IncomingMessage {
  externalId: string;
  channelId?: string;
  threadId?: string;
  replyToExternalId?: string;
  authorName: string;
  authorExternalId?: string;
  content: string;
  permalink?: string;
  sentAt: string;
  source: 'discord' | 'simulator';
}

export interface ExtractedItem {
  type: ItemType;
  title: string;
  summary: string;
  owner_name: string | null;
  priority: Priority;
  due_at: string | null;
  confidence: number;
  suggested_reply: string | null;
  event: { start: string | null; end: string | null; location: string | null } | null;
  reasoning: string;
}

export interface Item {
  id: string;
  communityId: string;
  messageId: string;
  type: ItemType;
  title: string;
  summary: string | null;
  ownerName: string | null;
  priority: Priority;
  dueAt: string | null;
  confidence: number;
  urgencyScore: number;
  status: ItemStatus;
  suggestedReply: string | null;
  eventStart: string | null;
  eventEnd: string | null;
  eventLocation: string | null;
  sourceLink: string | null;
  createdAt: string;
  updatedAt: string;
}

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

export interface IngestRequest {
  communityId: string;
  message: IncomingMessage;
  context: IncomingMessage[];
}

export interface IngestResponse {
  messageId: string;
  items: Item[];
  failures: Failure[];
}

export type ReviewAction = 'approve' | 'edit' | 'reassign' | 'reject' | 'done';

export interface ReviewRequest {
  action: ReviewAction;
  patch?: Partial<Pick<Item, 'title' | 'ownerName' | 'priority' | 'dueAt' | 'type' | 'suggestedReply'>>;
  actor: string;
}

export interface Digest {
  generatedAt: string;
  open: Item[];
  overdue: Item[];
  unansweredQuestions: Item[];
  decisions: Item[];
  stats: {
    captured: number;
    pending: number;
    approved: number;
    failures: number;
    hoursSaved: number;
  };
}

export interface SimScriptStep {
  delayMs: number;
  message: IncomingMessage;
  cachedItems?: ExtractedItem[];
}

export const CONFIDENCE_THRESHOLD = 0.6;
export const DEMO_COMMUNITY_ID = '00000000-0000-0000-0000-000000000001';
