'use client';

// Whalie on/off on web — the counterpart to mobile's src/contexts/WhalieContext.tsx.
// Same sync rules as that file and as ./readerPrefs.ts, deliberately:
//
//   • profiles.whalie_enabled NULL = "never chosen" (no DB default). A browser
//     that has a stored choice seeds it; an untouched browser never writes.
//   • The device value applies immediately; the account value merges in after.
//   • Never write a fallback (the `false` we show when nothing is chosen) to
//     the server.
//   • Guests are device-only.
// Failures are silent: supabase-js resolves with { error } rather than
// throwing, and the local value always stands.
//
// Settings and the reader are siblings under AppShell (see AppearanceSection's
// header), so each calls useWhalie() and the two instances stay in step through
// the `whalie-changed` window event — the same pattern as `appearance-changed`.

import { useCallback, useEffect, useRef, useState } from 'react';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { ReaderThemeKey } from '../readerTypography';
import type { WhalePalette } from './whaleEngine';

export const WHALIE_STORAGE_KEY = 'immerse_whalie';
const CHANGED_EVENT = 'whalie-changed';

const parse = (raw: string | null): boolean | null =>
  raw === 'true' ? true : raw === 'false' ? false : null;

/** The browser's stored choice, or null when this browser never chose. */
export function getStoredWhalie(): boolean | null {
  if (typeof window === 'undefined') return null;
  try {
    return parse(localStorage.getItem(WHALIE_STORAGE_KEY));
  } catch {
    return null;
  }
}

// Every instance on the page shares these. A save that had not settled when a
// reconcile began (or that started during it) may not have reached the server
// before that reconcile's SELECT ran, so the remote value it read can be stale.
let savesStarted = 0;
let savesSettled = 0;

function storeLocal(enabled: boolean) {
  try {
    localStorage.setItem(WHALIE_STORAGE_KEY, String(enabled));
  } catch { /* private browsing — the session still works, it just won't persist */ }
  window.dispatchEvent(new CustomEvent<boolean>(CHANGED_EVENT, { detail: enabled }));
}

/**
 * Reconcile with the account. Resolves to the value that should show.
 * `isTouched` lets a caller veto applying the remote value when the user
 * changed the switch while the fetch was in flight.
 */
export async function initWhalie(
  supabase: SupabaseClient,
  userId: string | null,
  isTouched: () => boolean = () => false,
): Promise<boolean> {
  const local = getStoredWhalie();
  if (!userId) return local ?? false;
  const settledAtStart = savesSettled;
  // Another instance (Settings ↔ reader, or another tab) chose while this
  // reconcile was running: its value is newer than whatever the fetch read.
  const choseElsewhere = () => savesStarted > settledAtStart || getStoredWhalie() !== local;
  try {
    const { data, error } = await supabase
      .from('profiles').select('whalie_enabled').eq('id', userId).single();
    if (error) return local ?? false;

    const remote = (data as { whalie_enabled?: boolean | null } | null)?.whalie_enabled;
    if (remote == null) {
      // Never chosen on the account: seed only from a real device choice.
      const seed = getStoredWhalie();
      if (seed !== null) {
        await supabase.from('profiles').update({ whalie_enabled: seed }).eq('id', userId);
      }
      return seed ?? false;
    }
    if (isTouched() || choseElsewhere()) return getStoredWhalie() ?? false;
    const value = !!remote;
    if (value !== local) storeLocal(value);
    return value;
  } catch {
    return local ?? false;   // keep the device value
  }
}

/** Persist a choice on this browser and, when signed in, on the account. */
export async function saveWhalie(supabase: SupabaseClient, userId: string | null, enabled: boolean) {
  storeLocal(enabled);
  if (!userId) return;
  savesStarted++;
  try {
    await supabase.from('profiles').update({ whalie_enabled: enabled }).eq('id', userId);
  } catch { /* local value stands */ } finally {
    savesSettled++;
  }
}

export function useWhalie(supabase: SupabaseClient, userId: string | null) {
  const [enabled, setEnabledState] = useState(false);
  const [ready, setReady] = useState(false);
  // A slow profile fetch must not overwrite a choice made while it was in flight.
  const touched = useRef(false);

  // 1. Device value — applies first. Then follow changes from other instances
  //    (settings ↔ reader) and other tabs.
  useEffect(() => {
    const stored = getStoredWhalie();
    if (stored !== null && !touched.current) setEnabledState(stored);
    setReady(true);
    const onChanged = (e: Event) => setEnabledState(!!(e as CustomEvent<boolean>).detail);
    const onStorage = (e: StorageEvent) => {
      if (e.key !== WHALIE_STORAGE_KEY) return;
      const v = parse(e.newValue);
      if (v !== null) setEnabledState(v);
    };
    window.addEventListener(CHANGED_EVENT, onChanged);
    window.addEventListener('storage', onStorage);
    return () => {
      window.removeEventListener(CHANGED_EVENT, onChanged);
      window.removeEventListener('storage', onStorage);
    };
  }, []);

  // 2. Account value — reconciles after.
  useEffect(() => {
    if (!userId) return;
    let cancelled = false;
    initWhalie(supabase, userId, () => touched.current).then(v => {
      if (!cancelled && !touched.current) setEnabledState(v);
    });
    return () => { cancelled = true; };
    // supabase is a stable browser client; re-running on identity churn would refetch.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId]);

  const setEnabled = useCallback((next: boolean) => {
    touched.current = true;
    setEnabledState(next);
    void saveWhalie(supabase, userId, next);
  }, [supabase, userId]);

  return { enabled, setEnabled, ready };
}

/**
 * Port of mobile src/utils/readerChrome.ts `whaliePaletteFor`:
 * light/quiet → paper, sepia → sepia, dark/night → night; system resolves first.
 */
export function whaliePaletteFor(themeKey: ReaderThemeKey, isDark: boolean): WhalePalette {
  const key = themeKey === 'system' ? (isDark ? 'dark' : 'light') : themeKey;
  if (key === 'sepia') return 'sepia';
  if (key === 'dark' || key === 'night') return 'night';
  return 'paper';
}

/** Whether the app is in dark mode (`.dark` on <html>), live. */
export function useDocumentDark(): boolean {
  const [dark, setDark] = useState(false);
  useEffect(() => {
    const el = document.documentElement;
    const read = () => setDark(el.classList.contains('dark'));
    read();
    const mo = new MutationObserver(read);
    mo.observe(el, { attributes: true, attributeFilter: ['class'] });
    return () => mo.disconnect();
  }, []);
  return dark;
}
