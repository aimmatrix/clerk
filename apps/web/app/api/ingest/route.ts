import { extract, runGuards, buildContext, type ExtractResult, type IngestResponse } from '../_mock-core';
import { authorizeIngest } from '../_lib/auth';
import { fromStoreError, isUuid, jsonError, jsonOk, readJson } from '../_lib/http';
import { parseIngestRequest } from '../_lib/parse';
import { communityExists, markProcessed, replaceExtractions, upsertMessage } from '../_lib/store';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  const body = await readJson(req);
  const input = parseIngestRequest(body);
  if (!input) {
    return jsonError('Body must be { communityId, message, context } matching IngestRequest.', 400);
  }
  if (!isUuid(input.communityId)) return jsonError('communityId must be a UUID.', 400);
  if (!authorizeIngest(req, input.message.source, input.communityId)) {
    return jsonError('Ingest secret is missing or wrong.', 401);
  }

  try {
    if (!(await communityExists(input.communityId))) {
      return jsonError('That community does not exist.', 404);
    }

    const llmKey = process.env.LLM_API_KEY?.trim();
    const llmLocal = /localhost|127\.0\.0\.1/.test(process.env.LLM_BASE_URL ?? '');
    const fromSimulator = input.message.source === 'simulator';
    if (fromSimulator && !llmKey && !llmLocal) {
      // 503 → C7 falls back to cachedItems. Do not write, or the board would double-count.
      return jsonError('LLM is not configured. The simulator will use cached extractions.', 503);
    }

    const guarded = runGuards(input);
    if (guarded.action === 'skip') return jsonError('Bot and self messages are skipped.', 400);
    let extracted: ExtractResult;
    if (guarded.action === 'noise') {
      extracted = { items: guarded.items };
    } else if (guarded.action === 'fail') {
      extracted = { items: [], failure: { reason: guarded.reason, raw: guarded.raw } };
    } else {
      extracted = await extract(
        { ...guarded.input, context: buildContext(guarded.input.message, guarded.input.context) },
        { timeoutMs: 15_000 },
      );
    }

    // Simulator client has a bounded timeout and uses cache on non-OK. If the model produced
    // nothing useful, fail closed so cachedItems win instead of an empty board.
    if (
      fromSimulator &&
      extracted.items.length === 0 &&
      extracted.failure &&
      (extracted.failure.reason === 'llm_error' || extracted.failure.reason === 'invalid_json')
    ) {
      return jsonError('Extraction failed. The simulator will use cached extractions.', 503);
    }

    const saved = await upsertMessage(input.communityId, input.message);
    const persisted = await replaceExtractions({
      communityId: input.communityId,
      messageId: saved.id,
      sourceLink: input.message.permalink ?? null,
      items: extracted.items,
      failure: extracted.failure,
    });
    await markProcessed(saved.id);

    const response: IngestResponse = {
      messageId: saved.id,
      items: persisted.items,
      failures: persisted.failures,
    };
    return jsonOk(response, 201);
  } catch (error) {
    return fromStoreError(error);
  }
}
