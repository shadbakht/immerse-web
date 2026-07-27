'use client';

/**
 * Language preferences carried by the account rather than the device.
 *
 * Both settings already persist locally — `immerse_ui_language` and
 * `immerse:contentLang` — and that stays the fast path: the stored value is
 * applied on the first frame, before any network call, so a reload never
 * flashes English at a Russian reader. This layer only adds the second step,
 * reconciling that local value with the one on the account.
 *
 * The reconciliation rule, in both directions:
 *
 *   remote set    → the account wins, and the device adopts it. A user who
 *                   chose Français on their phone gets Français on the web.
 *   remote null   → the account has never held a preference, so the device
 *                   seeds it — but only from a language the user actually
 *                   chose here, never from the fallback default. Otherwise the
 *                   first browser to open the app would pin the account to
 *                   English on the user's behalf.
 *
 * `content_language` gets one extra guard, on the caller's side: a device
 * honours it only while that library is actually available there. It must not
 * write a fallback back to the account — a phone without the Spanish pack
 * would otherwise reset a Spanish reader's account to English simply by
 * launching.
 */

import type { SupabaseClient } from '@supabase/supabase-js';

export interface LanguagePrefs {
  ui: string | null;
  content: string | null;
}

/**
 * The account's stored languages, or null when they cannot be read.
 *
 * A failure is deliberately not the same as "no preference set": null here
 * means "unknown, change nothing", so an offline load leaves the local choice
 * alone rather than seeding the account from it.
 */
export async function fetchLanguagePrefs(
  supabase: SupabaseClient,
  userId: string,
): Promise<LanguagePrefs | null> {
  try {
    const { data, error } = await supabase
      .from('profiles')
      .select('ui_language, content_language')
      .eq('id', userId)
      .maybeSingle();
    if (error || !data) return null;
    return {
      ui: (data.ui_language as string | null) ?? null,
      content: (data.content_language as string | null) ?? null,
    };
  } catch {
    return null;
  }
}

/**
 * Write one or both languages to the account.
 *
 * Fire-and-forget by design: the local value has already been applied and
 * persisted, so a failed write costs the user nothing this session and is
 * corrected the next time they change the setting.
 */
export async function pushLanguagePrefs(
  supabase: SupabaseClient,
  userId: string,
  patch: { ui_language?: string; content_language?: string },
): Promise<void> {
  if (Object.keys(patch).length === 0) return;
  try {
    await supabase.from('profiles').update(patch).eq('id', userId);
  } catch { /* local value stands */ }
}
