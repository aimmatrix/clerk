import { createClient, type SupabaseClient } from '@supabase/supabase-js';

/**
 * Service-role Supabase client for API routes (X3) and post-back (X4).
 * Bypasses RLS. Must never be imported from a Client Component — no `NEXT_PUBLIC_` on the key.
 */

let cached: SupabaseClient | null | undefined;

function readUrl(): string | undefined {
  const value = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim() || process.env.SUPABASE_URL?.trim();
  return value || undefined;
}

function readServiceKey(): string | undefined {
  const value = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  return value || undefined;
}

export function isSupabaseServiceConfigured(): boolean {
  return Boolean(readUrl() && readServiceKey());
}

/** Throws if a browser bundle ever pulls this module in. */
function assertServer(): void {
  if (typeof window !== 'undefined') {
    throw new Error('supabase-server must only run on the server. Use supabase-browser.ts in the client.');
  }
}

/**
 * Shared service-role client, or `null` when env is missing.
 * Callers should treat `null` as 503 (database not configured).
 */
export function getSupabaseService(): SupabaseClient | null {
  assertServer();
  if (cached !== undefined) return cached;

  const url = readUrl();
  const key = readServiceKey();
  if (!url || !key) {
    cached = null;
    return cached;
  }

  cached = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    global: {
      headers: { 'X-Client-Info': 'clerk-api' },
      fetch: (input, init) => fetch(input, { ...init, cache: 'no-store' }),
    },
  });
  return cached;
}

/** Reset between tests. */
export function resetSupabaseService(): void {
  cached = undefined;
}
