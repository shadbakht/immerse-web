import { createClient } from '@supabase/supabase-js';

// Service-role client for server routes that act with NO user session — i.e.
// the Stripe webhook. The cookie-based client in ./server.ts runs as `anon`
// there, and profiles' only UPDATE policy is `auth.uid() = id`, so an update
// through it matches zero rows and "succeeds" without writing anything.
// NEVER import this from client code; it bypasses RLS.
export function createAdminClient() {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!key) throw new Error('SUPABASE_SERVICE_ROLE_KEY is not set');
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
