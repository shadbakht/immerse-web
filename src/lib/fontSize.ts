'use client';

// Shared reading/quote font-size, controlled by the Settings panel and applied
// app-wide via the --quote-font-size CSS variable. The reader body and every
// quote/snippet across screens reference this variable so they stay in sync.

import type { SupabaseClient } from '@supabase/supabase-js';

export type FontSize = 'Small' | 'Medium' | 'Large' | 'XL';

// Reading/quote body size (px) — the wide range. Drives --quote-font-size,
// consumed by the reader body + every quote/snippet across screens.
export const FONT_SIZE_PX: Record<FontSize, number> = {
  Small: 14,
  Medium: 17,
  Large: 20,
  XL: 24,
};

// Root html font-size (px). Tailwind's text-*/spacing utilities are rem-based,
// so scaling the root gently grows ALL UI chrome — nav menu, tag/note names,
// buttons, panels — alongside the reading text. Kept modest (15–19) so fixed
// px-width columns don't overflow. 16 = browser default = Medium.
export const ROOT_FONT_PX: Record<FontSize, number> = {
  Small: 15,
  Medium: 16,
  Large: 17.5,
  XL: 19,
};

export const DEFAULT_FONT_SIZE: FontSize = 'Large';
const STORAGE_KEY = 'immerse_font_size';

export function getStoredFontSize(): FontSize {
  if (typeof window === 'undefined') return DEFAULT_FONT_SIZE;
  const saved = localStorage.getItem(STORAGE_KEY) as FontSize | null;
  return saved && saved in FONT_SIZE_PX ? saved : DEFAULT_FONT_SIZE;
}

/** Set the CSS variables + persist to localStorage so they're available everywhere. */
export function applyFontSize(size: FontSize) {
  if (typeof document === 'undefined') return;
  document.documentElement.style.setProperty('--quote-font-size', `${FONT_SIZE_PX[size]}px`);
  // Root scale → grows nav/menu/tag UI text app-wide (rem-based Tailwind utils).
  // The calc() folds in the Arabic/Persian UI bump (--ui-script-scale, set by
  // applyUiLanguage from uiScriptScale). Whichever of the two runs last, the
  // var + calc resolve together, and a UI-language change re-resolves it live.
  // .reader-page body text is unaffected (it sizes from --quote-font-size in px);
  // rem-based reader HEADINGS do pick this factor up — an accepted minor
  // over-reach, since the reader body (the bulk) does not.
  document.documentElement.style.fontSize = `calc(${ROOT_FONT_PX[size]}px * var(--ui-script-scale, 1))`;
  try { localStorage.setItem(STORAGE_KEY, size); } catch {}
}

/** Apply the locally-stored size immediately, then sync from the user's profile. */
export async function initFontSize(supabase: SupabaseClient, userId: string | null) {
  applyFontSize(getStoredFontSize());
  if (!userId) return;
  try {
    const { data } = await supabase.from('profiles').select('font_size').eq('id', userId).single();
    const size = data?.font_size as FontSize | undefined;
    if (size && size in FONT_SIZE_PX) applyFontSize(size);
  } catch { /* keep local value */ }
}
