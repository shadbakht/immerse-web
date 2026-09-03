/**
 * Hand off to the Immerse app via its custom scheme, with a browser fallback.
 *
 * Sets `location.href` to `appUrl` (an `immerse://…` URL). If the app is
 * installed the OS foregrounds it and this page goes hidden. If it is NOT
 * installed nothing visible happens — so after a short delay, if this page is
 * still visible, navigate to `webFallbackUrl` instead.
 *
 * Used by the share page's "Import Compilation" / "Open in Reader" buttons —
 * the only actions that are meant to leave the browser.
 */
const FALLBACK_MS = 1200;

/**
 * Navigation seam. Real code points the browser at `url`; tests replace `go`
 * because this jsdom version won't allow `window.location` (or its `href`) to
 * be stubbed directly.
 */
export const _nav = {
  go(url: string): void {
    if (typeof window !== 'undefined') window.location.href = url;
  },
};

export function openInApp(appUrl: string, webFallbackUrl: string): void {
  if (typeof window === 'undefined') return;

  let done = false;
  const teardown = () => {
    document.removeEventListener('visibilitychange', onHide);
    window.removeEventListener('pagehide', onHide);
  };
  const onHide = (e: Event) => {
    if (e.type === 'visibilitychange' && document.visibilityState !== 'hidden') return;
    done = true;
    teardown();
  };

  document.addEventListener('visibilitychange', onHide);
  window.addEventListener('pagehide', onHide);

  _nav.go(appUrl);

  window.setTimeout(() => {
    teardown();
    if (done) return;
    _nav.go(webFallbackUrl);
  }, FALLBACK_MS);
}
