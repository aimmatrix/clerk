export interface SourceMessage {
  externalId: string;
  authorName: string;
  content: string;
  sentAt: string;
  /** True for the message the item was extracted from. */
  isTarget?: boolean;
}

/** The message an item came from, plus up to five preceding context messages. */
export interface SourceContext {
  message: SourceMessage;
  context: SourceMessage[];
}

export type ExitKind = "approve" | "reject" | "navigate";

export type ModalKind = "approve" | "edit" | "reassign" | null;
