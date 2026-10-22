import { NextResponse } from 'next/server';

/** Accepts the demo community id `…0001` (version nibble 0) as well as RFC UUIDs. */
const LOOSE_UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function isUuid(value: string): boolean {
  return LOOSE_UUID_RE.test(value);
}

export function jsonOk<T>(body: T, status = 200): NextResponse {
  return NextResponse.json(body, { status, headers: { 'cache-control': 'no-store' } });
}

export function jsonError(message: string, status: number, extra?: Record<string, unknown>): NextResponse {
  return NextResponse.json({ error: message, ...extra }, { status, headers: { 'cache-control': 'no-store' } });
}

export async function readJson(req: Request): Promise<unknown> {
  try {
    return await req.json();
  } catch {
    return null;
  }
}

export class StoreError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
    this.name = 'StoreError';
  }
}

export function fromStoreError(error: unknown): NextResponse {
  if (error instanceof StoreError) return jsonError(error.message, error.status);
  const message = error instanceof Error ? error.message : 'Something went wrong.';
  return jsonError(message, 500);
}
