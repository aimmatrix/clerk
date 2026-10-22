import { z } from 'zod';

/**
 * Strict JSON schema sent to the LLM as `response_format.json_schema`.
 * Kept verbatim from the PRD (section 2) so the provider sees the contract.
 */
export const EXTRACTION_JSON_SCHEMA = {
  name: 'clerk_extraction',
  strict: true,
  schema: {
    type: 'object',
    additionalProperties: false,
    required: ['items'],
    properties: {
      items: {
        type: 'array',
        items: {
          type: 'object',
          additionalProperties: false,
          required: [
            'type',
            'title',
            'summary',
            'owner_name',
            'priority',
            'due_at',
            'confidence',
            'suggested_reply',
            'event',
            'reasoning',
          ],
          properties: {
            type: {
              type: 'string',
              enum: ['request', 'task', 'event', 'question', 'decision', 'noise'],
            },
            title: { type: 'string', description: '<=80 chars, imperative' },
            summary: { type: 'string' },
            owner_name: { type: ['string', 'null'] },
            priority: { type: 'string', enum: ['P0', 'P1', 'P2', 'P3'] },
            due_at: {
              type: ['string', 'null'],
              description: 'ISO 8601, resolved against message sent_at, Europe/London',
            },
            confidence: { type: 'number', minimum: 0, maximum: 1 },
            suggested_reply: {
              type: ['string', 'null'],
              description: 'only for type=question',
            },
            event: {
              type: ['object', 'null'],
              additionalProperties: false,
              required: ['start', 'end', 'location'],
              properties: {
                start: { type: ['string', 'null'] },
                end: { type: ['string', 'null'] },
                location: { type: ['string', 'null'] },
              },
            },
            reasoning: { type: 'string', description: '<=20 words' },
          },
        },
      },
    },
  },
} as const;

/**
 * Providers running in `json_object` or plain mode do not enforce the schema,
 * so the validator is lenient about *absent* nullable keys (treated as null)
 * but strict about enums, ranges and types.
 */
const nullableString = z
  .string()
  .nullish()
  .transform((v) => v ?? null);

const eventSchema = z
  .object({
    start: nullableString,
    end: nullableString,
    location: nullableString,
  })
  .nullish()
  .transform((v) => v ?? null);

export const extractedItemSchema = z.object({
  type: z.enum(['request', 'task', 'event', 'question', 'decision', 'noise']),
  title: z.string().min(1),
  summary: z
    .string()
    .nullish()
    .transform((v) => v ?? ''),
  owner_name: nullableString,
  priority: z.enum(['P0', 'P1', 'P2', 'P3']),
  due_at: nullableString,
  confidence: z.number().min(0).max(1),
  suggested_reply: nullableString,
  event: eventSchema,
  reasoning: z
    .string()
    .nullish()
    .transform((v) => v ?? ''),
});

export const extractionResponseSchema = z.object({
  items: z.array(extractedItemSchema).min(1, 'items must contain at least one entry'),
});

export type ExtractionResponse = z.infer<typeof extractionResponseSchema>;
export type ParsedExtractedItem = z.infer<typeof extractedItemSchema>;
