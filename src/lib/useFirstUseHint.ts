'use client';

import { useCallback, useState } from 'react';

/**
 * The one-time tips that teach in place what the welcome tour no longer shows
 * (it is down to three screens; see components/FirstUseHint). Mirrors mobile's
 * hooks/useFirstUseHint. The web's selection bar has text labels, so it needs
 * no tip naming its buttons.
 */
export type FirstUseHintKey = 'marginIcon' | 'questionSearch';

const storageKey = (key: FirstUseHintKey) => `immerse.hint.${key}`;

/**
 * Whether a tip is still due in this browser, and `spend` to use it up. Read
 * once, up front: `due` is only ever consulted in event handlers, never
 * rendered, so the server's answer (no storage there, so false) can't cause a
 * hydration mismatch. If storage is blocked the tip never shows rather than
 * showing every time.
 */
export function useFirstUseHint(key: FirstUseHintKey): { due: boolean; spend: () => void } {
  const [due, setDue] = useState(() => {
    try { return localStorage.getItem(storageKey(key)) !== '1'; } catch { return false; }
  });
  const spend = useCallback(() => {
    setDue(false);
    try { localStorage.setItem(storageKey(key), '1'); } catch { /* nowhere to remember it */ }
  }, [key]);
  return { due, spend };
}
