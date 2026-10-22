// Public surface of @clerk/core. Explicit exports (not `export *`) because prompt.ts and ics.ts
// both define a `LondonParts` type; only the ics one is public.

export * from './types';

export { extract, normaliseWhen, resetExtractorCache } from './extractor';
export type { ExtractOptions, ExtractResult, ExtractFailure, ExtractMeta, ResponseMode } from './extractor';

export { EXTRACTION_JSON_SCHEMA, extractedItemSchema, extractionResponseSchema } from './schema';
export type { ExtractionResponse, ParsedExtractedItem } from './schema';

export {
  SYSTEM_PROMPT,
  buildMessages,
  buildUserPrompt,
  londonLocalToUtc,
  toLondonIso,
  LONDON_TZ,
  MAX_TARGET_CHARS,
  MAX_CONTEXT_CHARS,
  MAX_CONTEXT_MESSAGES,
} from './prompt';
export type { ChatMessage, UserPromptOptions } from './prompt';

export { rankUrgency } from './ranker';
export { buildContext } from './context';
export { buildDigest, formatPostBack } from './digest';
export type { PostBackOptions } from './digest';
export { toIcs, canExportIcs, toLondonParts } from './ics';
export type { LondonParts } from './ics';

export {
  MAX_MESSAGE_LENGTH,
  runGuards,
  shouldSkipMessage,
  sanitiseText,
  stripInjection,
  isEmojiOnly,
  truncateMessage,
  hasMeaningfulText,
} from './guards';
export type {
  GuardInput,
  GuardMessage,
  GuardNote,
  GuardOptions,
  GuardOutcome,
  GuardSkipReason,
  StripResult,
  TruncateResult,
} from './guards';
