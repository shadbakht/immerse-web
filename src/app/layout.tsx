import type { Metadata } from 'next';
import { Geist } from 'next/font/google';
import './globals.css';
import AppBanner from '@/components/AppBanner';
import { LanguageProvider } from '@/contexts/LanguageProvider';
import { SITE_URL } from '@/lib/siteUrl';

const geist = Geist({ subsets: ['latin'] });

// ─── App Store IDs ────────────────────────────────────────────────────────────
// iOS:     Set APP_STORE_ID to your numeric Apple ID (from App Store Connect →
//          App Information → Apple ID) once the app is approved.
//          Example: "6478293847"
const APP_STORE_ID    = '6774657926';

// Android: Set PLAY_STORE_ID to your package name once the app is live.
//          Example: "com.shadbakht.immerse"
const PLAY_STORE_ID   = 'com.shadbakht.immerse';

export const metadata: Metadata = {
  // metadataBase resolves every relative URL used in per-page metadata
  // (openGraph.images, alternates.canonical, …) to an absolute one — without
  // it Next falls back to whatever origin the request came in on, which
  // breaks canonical/OG tags behind preview deployments and proxies.
  metadataBase: new URL(SITE_URL),
  title: {
    default: 'Immerse',
    template: '%s — Immerse',
  },
  description: 'Sacred texts from all traditions',
  // The library was gated behind sign-in until 2026-08-21 (queue item #1,
  // project_session_aug21_growth_websync_queue.md); this is what actually
  // lets that content get indexed now that it's reachable.
  robots: { index: true, follow: true },
  openGraph: {
    siteName: 'Immerse',
    type: 'website',
    images: [{ url: '/immerse-icon.png', width: 1024, height: 1024 }],
  },
  twitter: {
    card: 'summary',
    images: ['/immerse-icon.png'],
  },
  icons: {
    icon: '/favicon.png',
    apple: '/favicon.png',
  },
  // Note: no apple-itunes-app meta tag. Safari's native Smart App Banner hides
  // itself when the app is installed and only works in Safari — we instead show
  // our own <AppBanner> on every mobile browser (see AppBanner.tsx).
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    // lang="en" is the server-rendered default; LanguageProvider updates
    // document.documentElement.lang once the stored choice is known.
    <html lang="en" className="h-full">
      <body className={`${geist.className} h-full bg-[#F8F7F4] dark:bg-[#0F1923] antialiased`}>
        <LanguageProvider>
          <AppBanner playStoreId={PLAY_STORE_ID} appStoreId={APP_STORE_ID} />
          {children}
        </LanguageProvider>
      </body>
    </html>
  );
}
