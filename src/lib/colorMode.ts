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
  // Keep the window's title bar (Mac "Add to Dock" apps, mobile browser
  // chrome) in step with the page background. Owned here rather than by Next's
  // `viewport.themeColor`: Next re-renders its head tags on client navigation,
  // which would reset the colour to light while `.dark` stays on <html>.
  let meta = document.querySelector<HTMLMetaElement>('meta[name="theme-color"][data-color-mode]');
  if (!meta) {
    meta = document.createElement('meta');
    meta.name = 'theme-color';
    meta.dataset.colorMode = '';
    document.head.appendChild(meta);
  }
  meta.content = isDark ? '#0F1923' : '#F8F7F4';
  try { localStorage.setItem(STORAGE_KEY, mode); } catch {}
}

/** Apply the stored mode immediately on app load. */
export function initColorMode() {
  applyColorMode(getStoredColorMode());
}
