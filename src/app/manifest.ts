import type { MetadataRoute } from 'next';

// Web app manifest (served at /manifest.webmanifest). Lets Safari's
// File → Add to Dock on macOS (and Chrome/Edge "Install") treat the site as an
// app: its own window, the right name and icon, and opening on the library at
// '/' (public, so guests land in guest mode instead of a login bounce).
// Colours match the light page background — the app's default mode; the
// title bar follows the in-app light/dark setting via <meta name="theme-color">
// (see applyColorMode in src/lib/colorMode.ts).
export default function manifest(): MetadataRoute.Manifest {
  return {
    id: '/',
    name: 'Immerse',
    short_name: 'Immerse',
    description: 'Sacred texts from all traditions',
    start_url: '/',
    scope: '/',
    display: 'standalone',
    background_color: '#F8F7F4',
    theme_color: '#F8F7F4',
    icons: [
      { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png' },
      { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png' },
      { src: '/favicon.png', sizes: '1024x1024', type: 'image/png' },
      // Padded copies for platforms that crop app icons into circles or other
      // shapes (Windows, Android): the whale sits inside the central safe zone
      // and the gradient runs to the edges. Regenerate from favicon.png if the
      // icon changes (whale scaled to 75%, left-edge gradient extended).
      { src: '/icons/maskable-192.png', sizes: '192x192', type: 'image/png', purpose: 'maskable' },
      { src: '/icons/maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
    ],
  };
}
