import type { SimScriptStep } from '@clerk/core';
import script from '../../../demo/seed/london-meetup.json';

const ITEM_TYPES = ['request', 'task', 'event', 'question', 'decision', 'noise'];
const PRIORITIES = ['P0', 'P1', 'P2', 'P3'];

function fail(path: string, problem: string): never {
  throw new Error(`Invalid simulator script at ${path}: ${problem}`);
}

function isIso(value: unknown): boolean {
  return typeof value === 'string' && !Number.isNaN(Date.parse(value));
}

function isNullableIso(value: unknown): boolean {
  return value === null || isIso(value);
}

function checkItem(item: any, path: string): void {
  if (!item || typeof item !== 'object') fail(path, 'item must be an object');
  if (!ITEM_TYPES.includes(item.type)) fail(`${path}.type`, `unknown type ${String(item.type)}`);
  if (typeof item.title !== 'string' || !item.title || item.title.length > 80) fail(`${path}.title`, 'must be 1-80 characters');
  if (typeof item.summary !== 'string') fail(`${path}.summary`, 'must be a string');
  if (item.owner_name !== null && typeof item.owner_name !== 'string') fail(`${path}.owner_name`, 'must be string or null');
  if (!PRIORITIES.includes(item.priority)) fail(`${path}.priority`, `unknown priority ${String(item.priority)}`);
  if (!isNullableIso(item.due_at)) fail(`${path}.due_at`, 'must be ISO 8601 or null');
  if (typeof item.confidence !== 'number' || item.confidence < 0 || item.confidence > 1) fail(`${path}.confidence`, 'must be 0-1');
  if (item.suggested_reply !== null && typeof item.suggested_reply !== 'string') fail(`${path}.suggested_reply`, 'must be string or null');
  if (item.suggested_reply !== null && item.type !== 'question') fail(`${path}.suggested_reply`, 'only allowed for questions');
  if (item.event !== null) {
    const e = item.event;
    if (!e || typeof e !== 'object' || !isNullableIso(e.start) || !isNullableIso(e.end) || (e.location !== null && typeof e.location !== 'string')) {
      fail(`${path}.event`, 'must be null or {start, end, location}');
    }
  }
  if (typeof item.reasoning !== 'string') fail(`${path}.reasoning`, 'must be a string');
}

/** Throws a descriptive error unless `raw` is a valid SimScriptStep[]. */
export function validateScript(raw: unknown): SimScriptStep[] {
  if (!Array.isArray(raw) || raw.length === 0) fail('$', 'must be a non-empty array');
  const seen = new Set<string>();
  raw.forEach((step: any, i) => {
    const path = `[${i}]`;
    if (typeof step?.delayMs !== 'number' || step.delayMs <= 0) fail(`${path}.delayMs`, 'must be a positive number');
    const m = step.message;
    if (!m || typeof m !== 'object') fail(`${path}.message`, 'missing');
    if (typeof m.externalId !== 'string' || !m.externalId) fail(`${path}.message.externalId`, 'missing');
    if (seen.has(m.externalId)) fail(`${path}.message.externalId`, `duplicate ${m.externalId}`);
    seen.add(m.externalId);
    if (typeof m.authorName !== 'string' || !m.authorName) fail(`${path}.message.authorName`, 'missing');
    if (typeof m.content !== 'string' || !m.content) fail(`${path}.message.content`, 'missing');
    if (!isIso(m.sentAt)) fail(`${path}.message.sentAt`, 'must be ISO 8601');
    if (m.source !== 'simulator') fail(`${path}.message.source`, "must be 'simulator'");
    if (m.replyToExternalId && !seen.has(m.replyToExternalId)) fail(`${path}.message.replyToExternalId`, `${m.replyToExternalId} does not appear earlier`);
    if (step.cachedItems !== undefined) {
      if (!Array.isArray(step.cachedItems)) fail(`${path}.cachedItems`, 'must be an array');
      step.cachedItems.forEach((item: unknown, j: number) => checkItem(item, `${path}.cachedItems[${j}]`));
    }
  });
  return raw as SimScriptStep[];
}

/** The London meetup demo script, validated. Synchronous; `await` is also fine. */
export function loadScript(): SimScriptStep[] {
  return validateScript(script);
}

/** Total playback time of a script in ms at the given speed multiplier (1, 2 or 4). */
export function scriptDurationMs(steps: SimScriptStep[], speed = 1): number {
  return Math.round(steps.reduce((total, s) => total + s.delayMs, 0) / speed);
}
