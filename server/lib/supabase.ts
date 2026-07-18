import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import type { Env } from '../env';

/**
 * Service-role client — bypasses RLS. Server-only; the browser never sees this key.
 * Created per-request (Workers isolates are cheap; supabase-js holds no connections).
 */
export function serviceClient(env: Env): SupabaseClient {
  return createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
