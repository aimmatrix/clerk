import { probeLlm } from '../_mock-core';
import { jsonOk } from '../_lib/http';
import { probeDb } from '../_lib/store';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET() {
  const [db, llm] = await Promise.all([probeDb(), probeLlm()]);
  return jsonOk({ ok: db, llm, db });
}
