'use client';

// Shared reading/quote font-size, controlled by the Settings panel and applied
// app-wide via the --quote-font-size CSS variable. The reader body and every
// quote/snippet across screens reference this variable so they stay in sync.

import type { SupabaseClient } from '@supabase/supabase-js';

export type FontSize = 'Small' | 'Medium' | 'Large' | 'XL';

export const FONT_SIZE_PX: Record<FontSize, number> = {
  Small: 14,
  Medium: 16,
  Large: 18,
  XL: 21,
};

export const DEFAULT_FONT_SIZE: FontSize = 'Large';
const STORAGE_KEY = 'immerse_font_size';

export function getStoredFontSize(): FontSize {
  if (typeof window === 'undefined') return DEFAULT_FONT_SIZE;
  const saved = localStorage.getItem(STORAGE_KEY) as FontSize | null;
  return saved && saved in FONT_SIZE_PX ? saved : DEFAULT_FONT_SIZE;
}

/** Set the CSS variable + persist to localStorage so it's available everywhere. */
export function applyFontSize(size: FontSize) {
  if (typeof document === 'undefined') return;
  document.documentElement.style.setProperty('--quote-font-size', `${FONT_SIZE_PX[size]}px`);
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
