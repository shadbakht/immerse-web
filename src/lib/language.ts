'use client';

// App-wide UI language. Stored locally so it applies on every page load before
// Settings is ever opened, mirroring colorMode.ts and fontSize.ts.
//
// This is the language of the CHROME — buttons, menus, headings. Which library
// you read is a separate setting (`immerse:contentLang`, owned by LibraryPanel),
// exactly as on mobile: a Spanish speaker may well read the English corpus, and
// an English speaker browsing the Spanish Bible should not have the app flip to
// Spanish underneath them.

import { SUPPORTED_UI_LANGUAGES } from '@immerse/i18n';

const STORAGE_KEY = 'immerse_ui_language';

export const DEFAULT_UI_LANGUAGE = 'en';

/** Browser locale reduced to a bare language tag, e.g. "es-419" → "es". */
function browserLanguage(): string {
  if (typeof navigator === 'undefined') return DEFAULT_UI_LANGUAGE;
  const tag = navigator.language || DEFAULT_UI_LANGUAGE;
  const base = String(tag).split(/[-_]/)[0].toLowerCase();
  return base || DEFAULT_UI_LANGUAGE;
}

/**
 * Stored choice, else the browser's language when we actually translate it,
 * else English. Returns the default on the server so the first render is
 * deterministic — see LanguageProvider for why that matters.
 */
export function getStoredUiLanguage(): string {
  if (typeof window === 'undefined') return DEFAULT_UI_LANGUAGE;
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved && SUPPORTED_UI_LANGUAGES.includes(saved)) return saved;
  } catch { /* private mode — fall through to the browser locale */ }
  const detected = browserLanguage();
  return SUPPORTED_UI_LANGUAGES.includes(detected) ? detected : DEFAULT_UI_LANGUAGE;
}

/** Persist the choice and keep <html lang> honest for screen readers. */
export function applyUiLanguage(lang: string) {
  if (typeof document === 'undefined') return;
  document.documentElement.lang = lang;
  try { localStorage.setItem(STORAGE_KEY, lang); } catch { /* ignore */ }
}
