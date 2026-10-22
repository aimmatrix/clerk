import { createClient, type SupabaseClient } from '@supabase/supabase-js';

/**
 * Browser-side Supabase client. Anon key only — the service-role key must never reach the browser
 * (it lives in `supabase-server.ts`, X3). Reads are governed by RLS: owners see their community,
 * everyone can read the demo community (see 0001_init.sql).
 */

let client: SupabaseClient | null | undefined;

/** `sb_secret_…` keys and legacy JWTs with `role: service_role` bypass RLS and must never be bundled. */
function isServiceKey(key: string): boolean {
  if (key.startsWith('sb_secret_')) return true;
  const payload = key.split('.')[1];
  if (!payload) return false;
  try {
    const json = JSON.parse(atob(payload.replace(/-/g, '+').replace(/_/g, '/'))) as { role?: string };
    return json.role === 'service_role';
  } catch {
    return false;
  }
}

export function isSupabaseConfigured(): boolean {
  return Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);
}

/**
 * Returns the shared browser client, or `null` when running on the server or when the public env vars
 * are missing. Callers must treat `null` as "offline mode" (the simulator keeps working client-side).
 */
export function getSupabaseBrowser(): SupabaseClient | null {
  if (client !== undefined) return client;
  if (typeof window === 'undefined') return null; // don't cache: the browser may still create one

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anonKey) {
    client = null;
    return client;
  }
  if (isServiceKey(anonKey)) {
    console.error(
      '[clerk] NEXT_PUBLIC_SUPABASE_ANON_KEY holds a service-role/secret key. Refusing to create a browser client — use the anon (public) key.',
    );
    client = null;
    return client;
  }

  client = createClient(url, anonKey, {
    auth: { persistSession: true, autoRefreshToken: true },
    realtime: { params: { eventsPerSecond: 20 } },
  });
  return client;
}
