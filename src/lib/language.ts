'use client';

// App-wide UI language. Stored locally so it applies on every page load before
// Settings is ever opened, mirroring colorMode.ts and fontSize.ts.
//
// This is the language of the CHROME — buttons, menus, headings. Which library
// you read is a separate setting (`immerse:contentLang`, owned by LibraryPanel),
// exactly as on mobile: a Spanish speaker may well read the English corpus, and
// an English speaker browsing the Spanish Bible should not have the app flip to
// Spanish underneath them.

import { SUPPORTED_UI_LANGUAGES, directionOf } from '@immerse/i18n';

const STORAGE_KEY = 'immerse_ui_language';

export const DEFAULT_UI_LANGUAGE = 'en';

/** A locale tag reduced to its language subtag, e.g. "es-419" → "es". */
export function baseLanguage(tag: string): string {
  return String(tag).split(/[-_]/)[0].toLowerCase();
}

/**
 * The browser's preferred languages, in order, reduced to language subtags.
 *
 * `navigator.languages` rather than `navigator.language`, because the two
 * disagree in exactly the case worth getting right: someone whose first choice
 * is a language Immerse does not speak. A browser set to [de, fr, en] gets
 * French rather than English, which is what that list is for — reading only the
 * first entry throws the rest of the user's stated preference away.
 */
function browserLanguages(): string[] {
  if (typeof navigator === 'undefined') return [];
  const tags = navigator.languages?.length
    ? navigator.languages
    : [navigator.language].filter(Boolean);
  return tags.map(baseLanguage).filter(Boolean);
}

/**
 * Stored choice, else the browser's language when we actually translate it,
 * else English. Returns the default on the server so the first render is
 * deterministic — see LanguageProvider for why that matters.
 */
export function getStoredUiLanguage(): string {
  return getChosenUiLanguage() ?? detectedUiLanguage();
}

/**
 * The language this browser was *told* to use, or null if nobody ever said.
 *
 * The distinction matters only for account sync: a stored value is a choice
 * worth seeding an empty account with, while the browser locale is a guess and
 * must not be written to the account as though the user had made it. Everything
 * else should call getStoredUiLanguage() and not care which it got.
 */
export function getChosenUiLanguage(): string | null {
  if (typeof window === 'undefined') return null;
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved && SUPPORTED_UI_LANGUAGES.includes(saved)) return saved;
  } catch { /* private mode — no stored choice to read */ }
  return null;
}

/** The first of the browser's languages that Immerse actually speaks. */
export function detectedUiLanguage(): string {
  return browserLanguages().find(l => SUPPORTED_UI_LANGUAGES.includes(l))
    ?? DEFAULT_UI_LANGUAGE;
}

// ─── Content language ────────────────────────────────────────────────────────
// Which library is being read, as opposed to which language the chrome is in.
// It moved here from LibraryPanel's local state when the two settings started
// syncing to the account: they are one pair of preferences and reconciling them
// in two different components would have meant two different rules.

const CONTENT_KEY = 'immerse:contentLang';

export const DEFAULT_CONTENT_LANGUAGE = 'en';

/** The library language this browser was told to use, or null if never set. */
export function getChosenContentLanguage(): string | null {
  if (typeof window === 'undefined') return null;
  try {
    return localStorage.getItem(CONTENT_KEY) || null;
  } catch {
    return null;
  }
}

export function storeContentLanguage(lang: string) {
  try { localStorage.setItem(CONTENT_KEY, lang); } catch { /* ignore */ }
}

/**
 * Keep <html lang> honest for screen readers, and set <html dir> so the layout
 * mirrors for right-to-left languages.
 *
 * `dir` is what makes RTL work at all: it flips text direction, flex `row`,
 * and every logical property (`ms-`, `pe-`, `start-`, `text-start`) in one
 * move. It does not touch physical ones — `ml-`, `left-`, `text-left` stay
 * put — which is why the components use logical utilities throughout.
 *
 * Deliberately does NOT persist. It used to, which was harmless until the
 * languages started syncing: applying the *detected* browser language on mount
 * wrote it to storage, and one frame later it was indistinguishable from a
 * language the user had chosen — enough to seed an empty account with a guess.
 * Storing is now its own call, made only where there is a choice to store.
 */
export function applyUiLanguage(lang: string) {
  if (typeof document === 'undefined') return;
  document.documentElement.lang = lang;
  document.documentElement.dir = directionOf(lang);
}

/** Record a UI language the user chose, or one adopted from their account. */
export function storeUiLanguage(lang: string) {
  try { localStorage.setItem(STORAGE_KEY, lang); } catch { /* ignore */ }
}
