'use client';

// App-wide light/dark/system color mode. Toggles the `.dark` class on <html>,
// which all `dark:` Tailwind utilities + the CSS color tokens key off of.
// Stored locally so it applies instantly on every page load (before Settings
// is ever opened), mirroring fontSize.ts.

export type ColorMode = 'light' | 'dark' | 'system';

const STORAGE_KEY = 'immerse_color_mode';

export function getStoredColorMode(): ColorMode {
  if (typeof window === 'undefined') return 'light';
  const v = localStorage.getItem(STORAGE_KEY) as ColorMode | null;
  return v === 'dark' || v === 'system' ? v : 'light';
}

/** Resolve `system` against the OS preference and toggle the `.dark` class. */
export function applyColorMode(mode: ColorMode) {
  if (typeof document === 'undefined') return;
  const isDark =
    mode === 'dark' ||
    (mode === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches);
  document.documentElement.classList.toggle('dark', isDark);
  try { localStorage.setItem(STORAGE_KEY, mode); } catch {}
}

/** Apply the stored mode immediately on app load. */
export function initColorMode() {
  applyColorMode(getStoredColorMode());
}
