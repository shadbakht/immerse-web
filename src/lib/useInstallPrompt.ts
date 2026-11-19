'use client';

import { useSyncExternalStore } from 'react';

// "Install App" support for Chromium browsers (Chrome, Edge, Brave). They fire
// `beforeinstallprompt` once the site qualifies as installable (manifest +
// icons, see app/manifest.ts); holding on to that event lets our own button
// open the browser's install dialog. Safari and Firefox never fire it, so the
// button simply never appears there (Safari users have File → Add to Dock).

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

let deferred: BeforeInstallPromptEvent | null = null;
const listeners = new Set<() => void>();
const notify = () => listeners.forEach(l => l());

// Captured at module load rather than in an effect: the browser may fire the
// event before the component that shows the button has mounted.
if (typeof window !== 'undefined') {
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault(); // keep Chrome's own mini-infobar from popping up
    deferred = e as BeforeInstallPromptEvent;
    notify();
  });
  window.addEventListener('appinstalled', () => {
    deferred = null;
    notify();
  });
}

function isStandalone() {
  return (
    window.matchMedia('(display-mode: standalone)').matches ||
    // Safari's own flag for Home Screen / Dock web apps
    (navigator as Navigator & { standalone?: boolean }).standalone === true
  );
}

/** `canInstall` is true only when the browser will show an install dialog and
 *  we aren't already running as the installed app. */
export function useInstallPrompt() {
  const canInstall = useSyncExternalStore(
    (onChange) => { listeners.add(onChange); return () => { listeners.delete(onChange); }; },
    () => deferred !== null && !isStandalone(),
    () => false, // server render: never show
  );

  const install = async () => {
    const e = deferred;
    if (!e) return;
    await e.prompt();
    await e.userChoice.catch(() => null);
    // The event can only be used once, accepted or not.
    deferred = null;
    notify();
  };

  return { canInstall, install };
}
