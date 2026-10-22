/**
 * G2 evaluation, with one expected item per message.
 *
 * Run from the monorepo root with LLM_* environment variables exported:
 *   pnpm tsx demo/seed/eval/score.ts
 *   pnpm tsx demo/seed/eval/score.ts --validate
 *   pnpm tsx demo/seed/eval/score.ts --self-test
 *   pnpm tsx demo/seed/eval/score.ts --predictions /path/to/predictions.json
 *
 * Offline predictions: [{ id: "g2-001", items: [{ type, owner_name, priority }] }].
 * All 60 IDs are required; expected labels are never sent to extract().
 * Type and priority accuracy require exactly one prediction. Abstentions,
 * extractor failures and extra items count as errors, including for noise.
 * Owner F1 is micro-averaged over named owners, normalised with NFKC,
 * whitespace folding and case folding. Null/null is a true negative, not a TP.
 * Every extra named prediction counts as a false positive. Owner scoring is
 * independent of type/priority. If neither side names anyone, owner F1 is 1.
 * These synthetic, balanced cases are a smoke benchmark, not production recall.
 */
import { strict as assert } from 'node:assert';
import { readFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import type { IncomingMessage, IngestRequest } from '@clerk/core';

const TYPES = ['request', 'task', 'event', 'question', 'decision', 'noise'] as const;
const PRIORITIES = ['P0', 'P1', 'P2', 'P3'] as const;
const COLUMNS = [...TYPES, '<none>', '<multiple>'] as const;
const COMMUNITY_ID = '00000000-0000-0000-0000-000000000001';
const MIN_TYPE_ACCURACY = 0.85;
type ItemType = (typeof TYPES)[number];
type Priority = (typeof PRIORITIES)[number];
type Column = (typeof COLUMNS)[number];
type Label = { type: ItemType; owner_name: string | null; priority: Priority };
type EvalCase = {
  id: string;
  message: IncomingMessage;
  context: IncomingMessage[];
  expected: Label;
  note: string;
};
type Prediction = { id: string; items: Label[]; error?: string };

function object(value: unknown, where: string): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error(`${where}: expected an object`);
  }
  return value as Record<string, unknown>;
}

function label(value: unknown, where: string): Label {
  const row = object(value, where);
  if (!TYPES.includes(row.type as ItemType)) throw new Error(`${where}: invalid type`);
  if (!PRIORITIES.includes(row.priority as Priority)) throw new Error(`${where}: invalid priority`);
  if (row.owner_name !== null && (typeof row.owner_name !== 'string' || !row.owner_name.trim())) {
    throw new Error(`${where}: owner_name must be a nonempty string or null`);
  }
  return { type: row.type as ItemType, owner_name: row.owner_name as string | null, priority: row.priority as Priority };
}

function message(value: unknown, where: string): IncomingMessage {
  const row = object(value, where);
  for (const key of ['externalId', 'authorName', 'content', 'sentAt']) {
    if (typeof row[key] !== 'string' || !row[key]) throw new Error(`${where}: missing ${key}`);
  }
  if (!Number.isFinite(Date.parse(row.sentAt as string))) throw new Error(`${where}: invalid sentAt`);
  if (row.source !== 'discord' && row.source !== 'simulator') throw new Error(`${where}: invalid source`);
  for (const key of ['channelId', 'threadId', 'replyToExternalId', 'authorExternalId', 'permalink']) {
    if (row[key] !== undefined && typeof row[key] !== 'string') throw new Error(`${where}: invalid ${key}`);
  }
  return row as unknown as IncomingMessage;
}

function readCases(value: unknown): EvalCase[] {
  if (!Array.isArray(value) || value.length !== 60) throw new Error('cases.json must contain exactly 60 cases');
  const ids = new Set<string>();
  const messageIds = new Set<string>();
  const cases = value.map((entry, i) => {
    const row = object(entry, `case ${i + 1}`);
    if (typeof row.id !== 'string' || !row.id || ids.has(row.id)) throw new Error(`Invalid/duplicate case ID at ${i + 1}`);
    ids.add(row.id);
    if (!Array.isArray(row.context) || row.context.length > 5) throw new Error(`${row.id}: context must have at most 5 messages`);
    const target = message(row.message, `${row.id}.message`);
    const context = row.context.map((entry, j) => message(entry, `${row.id}.context[${j}]`));
    if (messageIds.has(target.externalId)) throw new Error(`${row.id}: duplicate target externalId`);
    messageIds.add(target.externalId);
    const localIds = new Set([target.externalId]);
    for (const previous of context) {
      if (localIds.has(previous.externalId)) throw new Error(`${row.id}: duplicate context externalId`);
      localIds.add(previous.externalId);
      if (Date.parse(previous.sentAt) > Date.parse(target.sentAt)) throw new Error(`${row.id}: context is in the future`);
    }
    if (target.replyToExternalId && !context.some((entry) => entry.externalId === target.replyToExternalId)) {
      throw new Error(`${row.id}: reply target is missing from context`);
    }
    if (typeof row.note !== 'string' || !row.note.trim()) throw new Error(`${row.id}: missing annotation note`);
    const expected = label(row.expected, `${row.id}.expected`);
    if (expected.owner_name) {
      const names = [target.authorName, target.content, ...context.flatMap((entry) => [entry.authorName, entry.content])].join('\n');
      if (!names.includes(expected.owner_name)) throw new Error(`${row.id}: expected owner is absent from input`);
    }
    return { id: row.id, message: target, context, expected, note: row.note };
  });
  for (const type of TYPES) {
    if (cases.filter((entry) => entry.expected.type === type).length !== 10) {
      throw new Error(`Expected exactly 10 ${type} cases`);
    }
  }
  return cases;
}

function ownerKey(name: string): string {
  return name.normalize('NFKC').trim().replace(/\s+/gu, ' ').toLocaleLowerCase('en-GB');
}

function score(cases: EvalCase[], predictions: Prediction[]) {
  const matrix = Object.fromEntries(TYPES.map((type) => [type, Object.fromEntries(COLUMNS.map((column) => [column, 0]))])) as Record<ItemType, Record<Column, number>>;
  let correctType = 0;
  let priorityWithinOne = 0;
  let tp = 0;
  let fp = 0;
  let fn = 0;
  const problems: string[] = [];
  for (let i = 0; i < cases.length; i++) {
    const entry = cases[i]!;
    const result = predictions[i];
    if (!result || result.id !== entry.id) throw new Error(`Prediction alignment error at ${entry.id}`);
    const items = result.error ? [] : result.items;
    const single = items.length === 1 ? items[0] : undefined;
    const column: Column = single ? single.type : items.length ? '<multiple>' : '<none>';
    matrix[entry.expected.type][column]++;
    const typeOk = single?.type === entry.expected.type;
    const priorityOk = !!single && Math.abs(PRIORITIES.indexOf(single.priority) - PRIORITIES.indexOf(entry.expected.priority)) <= 1;
    if (typeOk) correctType++;
    if (priorityOk) priorityWithinOne++;

    const named = items.flatMap((item) => item.owner_name === null ? [] : [ownerKey(item.owner_name)]);
    const expectedOwner = entry.expected.owner_name === null ? null : ownerKey(entry.expected.owner_name);
    const matched = expectedOwner !== null && named.includes(expectedOwner);
    if (matched) tp++;
    fp += named.length - Number(matched);
    if (expectedOwner !== null && !matched) fn++;
    const ownerOk = expectedOwner === null ? named.length === 0 : matched && named.length === 1;
    if (!typeOk || !priorityOk || !ownerOk || result.error) {
      problems.push(`${entry.id}: expected ${JSON.stringify(entry.expected)}; got ${JSON.stringify(items)}${result.error ? `; ${result.error}` : ''}`);
    }
  }
  const precision = tp + fp === 0 ? (fn === 0 ? 1 : 0) : tp / (tp + fp);
  const recall = tp + fn === 0 ? 1 : tp / (tp + fn);
  const ownerF1 = 2 * tp + fp + fn === 0 ? 1 : (2 * tp) / (2 * tp + fp + fn);
  return { matrix, correctType, priorityWithinOne, tp, fp, fn, precision, recall, ownerF1, typeAccuracy: correctType / cases.length, problems };
}

function selfTest(): void {
  const fixture = (expected: Label): EvalCase => ({ id: 'test', expected } as EvalCase);
  const task: Label = { type: 'task', owner_name: 'Ana', priority: 'P1' };
  const run = (expected: Label, items: Label[], error?: string) => score([fixture(expected)], [{ id: 'test', items, error }]);
  const perfect = run(task, [{ ...task, owner_name: '  ANA  ' }]);
  assert.equal(perfect.typeAccuracy, 1);
  assert.equal(perfect.ownerF1, 1);
  assert.equal(run(task, [{ ...task, owner_name: 'Sam' }]).ownerF1, 0);
  assert.equal(run(task, [{ ...task, owner_name: null }]).fn, 1);
  assert.equal(run({ ...task, owner_name: null }, [task]).fp, 1);
  assert.equal(run(task, [{ ...task, priority: 'P2' }]).priorityWithinOne, 1);
  assert.equal(run(task, [{ ...task, priority: 'P3' }]).priorityWithinOne, 0);
  const extra = run(task, [task, task]);
  assert.equal(extra.typeAccuracy, 0);
  assert.equal(extra.priorityWithinOne, 0);
  assert.equal(extra.matrix.task['<multiple>'], 1);
  assert.equal(extra.fp, 1);
  assert.equal(extra.ownerF1, 2 / 3);
  const failure = run(task, [task], 'llm_error');
  assert.equal(failure.typeAccuracy, 0);
  assert.equal(failure.matrix.task['<none>'], 1);
  assert.equal(failure.fn, 1);
  assert.equal(run({ type: 'noise', owner_name: null, priority: 'P3' }, []).typeAccuracy, 0);
  assert.equal(run({ ...task, owner_name: null }, [{ ...task, owner_name: null }]).ownerF1, 1);
  const two = score([fixture(task), { ...fixture(task), id: 'test-2' }], [
    { id: 'test', items: [task] }, { id: 'test-2', items: [{ ...task, owner_name: 'Sam' }] },
  ]);
  assert.equal(two.ownerF1, 0.5);
  assert.equal(two.tp, 1);
  assert.equal(two.fp, 1);
  assert.equal(two.fn, 1);
  console.log('Scorer self-tests passed (owners, abstentions, extra items, priority distance and aggregation).');
}

function offlinePredictions(value: unknown, cases: EvalCase[]): Prediction[] {
  if (!Array.isArray(value)) throw new Error('Predictions must be an array');
  const indexed = new Map<string, Prediction>();
  const known = new Set(cases.map((entry) => entry.id));
  for (const entry of value) {
    const row = object(entry, 'prediction');
    if (typeof row.id !== 'string' || !known.has(row.id) || indexed.has(row.id)) throw new Error('Unknown or duplicate prediction ID');
    if (!Array.isArray(row.items)) throw new Error(`${row.id}: items must be an array`);
    if (row.error !== undefined && typeof row.error !== 'string') throw new Error(`${row.id}: error must be a string`);
    indexed.set(row.id, { id: row.id, items: row.items.map((item, i) => label(item, `${row.id}.items[${i}]`)), error: row.error as string | undefined });
  }
  return cases.map((entry) => {
    const result = indexed.get(entry.id);
    if (!result) throw new Error(`Missing prediction for ${entry.id}`);
    return result;
  });
}

const percent = (value: number) => `${(value * 100).toFixed(2)}%`;

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  if (args.length === 1 && args[0] === '--self-test') { selfTest(); return; }
  const validate = args.length === 1 && args[0] === '--validate';
  const offline = args.length === 2 && args[0] === '--predictions' ? args[1] : undefined;
  if (args.length > 0 && !validate && !offline) {
    throw new Error('Usage: pnpm tsx demo/seed/eval/score.ts [--validate | --self-test | --predictions FILE]');
  }
  const casesPath = resolve(dirname(resolve(process.argv[1]!)), 'cases.json');
  const cases = readCases(JSON.parse(await readFile(casesPath, 'utf8')) as unknown);
  console.log(`Validated ${cases.length} cases: 10 per type; one expected item per target message.`);
  if (validate) return;
  let predictions: Prediction[];
  if (offline) {
    console.log('Mode: offline predictions (no extractor or LLM calls).');
    predictions = offlinePredictions(JSON.parse(await readFile(resolve(offline), 'utf8')) as unknown, cases);
  } else {
    // Import only for the live run: validation/self-tests work before scaffold exists.
    const { extract } = await import('@clerk/core');
    if (typeof extract !== 'function') throw new Error('@clerk/core must export extract()');
    console.log('Mode: live extract() evaluation. LLM configuration comes from the environment.');
    predictions = [];
    for (const [index, entry] of cases.entries()) {
      console.log(`[${index + 1}/${cases.length}] ${entry.id}`);
      try {
        const input: IngestRequest = { communityId: COMMUNITY_ID, message: entry.message, context: entry.context };
        const result = await extract(input);
        if (result.failure) {
          predictions.push({ id: entry.id, items: [], error: `extractor failure: ${result.failure.reason}` });
        } else {
          if (!Array.isArray(result.items)) throw new Error('extract() returned no items array');
          predictions.push({ id: entry.id, items: result.items.map((item, i) => label(item, `${entry.id}.items[${i}]`)) });
        }
      } catch (error) {
        // Do not print exception text or raw LLM responses, which may contain credentials.
        predictions.push({ id: entry.id, items: [], error: error instanceof Error ? `exception (${error.name})` : 'exception' });
      }
    }
  }
  const result = score(cases, predictions);
  console.log(`\nType accuracy: ${percent(result.typeAccuracy)} (${result.correctType}/${cases.length})`);
  console.log(`Owner F1 (micro, named owners): ${result.ownerF1.toFixed(4)}`);
  console.log(`Owner precision: ${result.precision.toFixed(4)}; recall: ${result.recall.toFixed(4)}; TP=${result.tp}, FP=${result.fp}, FN=${result.fn}`);
  console.log(`Priority within-1 accuracy: ${percent(result.priorityWithinOne / cases.length)} (${result.priorityWithinOne}/${cases.length})`);
  console.log(`Extractor failures/exceptions: ${predictions.filter((entry) => entry.error).length}/${cases.length}`);
  console.log('\nConfusion matrix: rows = expected, columns = predicted; each case contributes once.');
  console.table(result.matrix);
  if (result.problems.length) {
    console.log('\nCases with a type, owner or within-1 priority error:');
    for (const problem of result.problems) console.log(problem);
  }
  const passed = result.typeAccuracy >= MIN_TYPE_ACCURACY;
  console.log(`\n${passed ? 'PASS' : 'FAIL'}: type accuracy ${passed ? 'meets' : 'is below'} 85% (at least 51/60 required).`);
  if (!passed) process.exitCode = 1;
}

main().catch((error: unknown) => {
  console.error(`Evaluation could not run (${error instanceof Error ? error.name : 'unknown error'}).`);
  console.error('Check the CLI arguments, cases/predictions JSON and workspace setup. Live mode needs @clerk/core exporting extract(), tsx and LLM_* environment variables.');
  process.exitCode = 1;
});
