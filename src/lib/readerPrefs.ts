'use client';

// Reader typography preferences on web — the counterpart to mobile's
// ReaderPrefsContext. Same sync rules, deliberately:
//
//   • NULL in profiles.reader_prefs means "never chosen", NOT "chose the
//     defaults". That is what tells the first device to seed it, which is why
//     the column has no database default.
//   • The device's stored value applies immediately; the account value merges
//     in afterwards. Nobody watches their page reflow while a fetch finishes.
//   • Never write a fallback back to the server — reconciling a value we
//     invented would turn "never chosen" into "chosen" behind the user's back.
//
// Values are pushed onto CSS custom properties rather than into React state so
// a preference change repaints without re-rendering the passage list, which on
// a long chapter is the difference between instant and visibly janky.

import type { SupabaseClient } from '@supabase/supabase-js';
import {
  DEFAULT_READER_PREFS, buildThemePayload, normalizePrefs, TYPEFACES,
  SCRIPT_FACES, scriptFaceFor, type ReaderPrefs,
} from './readerTypography';

const STORAGE_KEY = 'immerse_reader_prefs';

export function getStoredPrefs(): ReaderPrefs {
  if (typeof window === 'undefined') return DEFAULT_READER_PREFS;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? normalizePrefs(JSON.parse(raw)) : DEFAULT_READER_PREFS;
  } catch {
    return DEFAULT_READER_PREFS;
  }
}

/**
 * The font stack for a book: chosen Latin face, then the script face its
 * language needs, then a generic serif.
 *
 * The Latin face comes FIRST even though the script faces carry a
 * unicode-range — an ASCII digit inside a Persian verse should render in the
 * reading face, not in naskh's Latin.
 */
export function stackFor(prefs: ReaderPrefs, bookLanguage?: string | null): string {
  const def = TYPEFACES.find(t => t.key === prefs.typeface) ?? TYPEFACES[0];
  const script = scriptFaceFor(bookLanguage);
  if (!script) return def.stack;
  return `${def.stack.replace(/, serif$/, '')}, '${SCRIPT_FACES[script].family}', serif`;
}

/** Write the resolved values onto :root. Safe to call on every change. */
export function applyReaderPrefs(
  prefs: ReaderPrefs,
  opts: { fontSizePx: number; isDark: boolean; bookLanguage?: string | null } ,
) {
  if (typeof document === 'undefined') return;
  const p = buildThemePayload(prefs, opts.fontSizePx, opts.isDark);
  const s = document.documentElement.style;

  s.setProperty('--reader-font-family', stackFor(prefs, opts.bookLanguage));
  s.setProperty('--reader-line-height', String(p.lineHeight));
  s.setProperty('--reader-bg', p.background);
  s.setProperty('--reader-fg', p.text);
  s.setProperty('--reader-muted', p.muted);
  s.setProperty('--reader-rule', p.rule);
  s.setProperty('--reader-accent', p.accent);
  s.setProperty('--reader-pad', `${p.padding}px`);
  s.setProperty('--reader-max-width', `${p.maxWidth}px`);
  s.setProperty('--reader-gutter', `${p.gutter}px`);
  s.setProperty('--reader-text-align', p.justify ? 'justify' : 'start');
  s.setProperty('--reader-indent', p.indent ? '1.4em' : '0');
  s.setProperty('--reader-para-gap', `${p.paragraphGap}em`);
  s.setProperty('--reader-letter-spacing', `${p.letterSpacing}em`);
  s.setProperty('--reader-word-spacing', `${p.wordSpacing}em`);
  s.setProperty('--reader-weight', String(p.weight));
  s.setProperty('--reader-pnum-display', p.showParagraphNumbers ? 'block' : 'none');

  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(prefs));
  } catch { /* private browsing — the session still works, it just won't persist */ }
}

/** Apply the local value now, then reconcile from the account. */
export async function initReaderPrefs(
  supabase: SupabaseClient,
  userId: string | null,
  opts: { fontSizePx: number; isDark: boolean },
): Promise<ReaderPrefs> {
  const local = getStoredPrefs();
  applyReaderPrefs(local, opts);
  if (!userId) return local;

  try {
    const { data } = await supabase
      .from('profiles').select('reader_prefs').eq('id', userId).single();

    if (data?.reader_prefs == null) {
      // Never chosen on this account. Seed it from this browser — but only if
      // this browser has actually stored something. Seeding from untouched
      // defaults would write a choice the user never made and destroy the
      // "never chosen" signal for every other device.
      if (typeof window !== 'undefined' && localStorage.getItem(STORAGE_KEY)) {
        await supabase.from('profiles')
          .update({ reader_prefs: local }).eq('id', userId);
      }
      return local;
    }

    const remote = normalizePrefs(data.reader_prefs);
    applyReaderPrefs(remote, opts);
    return remote;
  } catch {
    return local;   // keep the device value; failures here are always silent
  }
}

/** Persist a change locally, push it to the account, and repaint. */
export async function saveReaderPrefs(
  supabase: SupabaseClient,
  userId: string | null,
  prefs: ReaderPrefs,
  opts: { fontSizePx: number; isDark: boolean; bookLanguage?: string | null },
) {
  applyReaderPrefs(prefs, opts);
  if (!userId) return;
  try {
    await supabase.from('profiles').update({ reader_prefs: prefs }).eq('id', userId);
  } catch { /* local value stands */ }
}
