import type { SupabaseClient } from '@supabase/supabase-js';

// New users get full Pro access free for this many days from signup, then the
// paywall reappears automatically. Anchored on the immutable auth.users
// created_at, so it can't be reset and matches the mobile app's TRIAL_DAYS.
export const TRIAL_DAYS = 30;

export function isInTrial(createdAt?: string | null): boolean {
  if (!createdAt) return false;
  return Date.now() - new Date(createdAt).getTime() < TRIAL_DAYS * 86_400_000;
}

// Effective Pro = paid (profiles.is_pro) OR an active signup-anchored trial.
// Uses getSession() (local, no network round-trip) for the auth created_at.
export async function resolveIsPro(supabase: SupabaseClient, userId: string): Promise<boolean> {
  const [{ data: prof }, { data: { session } }] = await Promise.all([
    supabase.from('profiles').select('is_pro').eq('id', userId).maybeSingle(),
    supabase.auth.getSession(),
  ]);
  return (prof?.is_pro ?? false) || isInTrial(session?.user?.created_at);
}
