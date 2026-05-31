import type { Metadata } from 'next';
import { Geist } from 'next/font/google';
import './globals.css';
import AppBanner from '@/components/AppBanner';

const geist = Geist({ subsets: ['latin'] });

// ─── App Store IDs ────────────────────────────────────────────────────────────
// iOS:     Set APP_STORE_ID to your numeric Apple ID (from App Store Connect →
//          App Information → Apple ID) once the app is approved.
//          Example: "6478293847"
const APP_STORE_ID    = '';   // TODO: fill in after App Store approval

// Android: Set PLAY_STORE_ID to your package name once the app is live.
//          Example: "com.shadbakht.immerse"
const PLAY_STORE_ID   = '';   // TODO: fill in after Play Store launch

export const metadata: Metadata = {
  title: 'Immerse',
  description: 'Sacred texts from all traditions',
  icons: {
    icon: '/favicon.png',
    apple: '/favicon.png',
  },
  // iOS native Smart App Banner — Safari renders this automatically when APP_STORE_ID is set
  other: APP_STORE_ID ? { 'apple-itunes-app': `app-id=${APP_STORE_ID}` } : undefined,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="h-full">
      <body className={`${geist.className} h-full bg-[#F8F7F4] antialiased`}>
        <AppBanner playStoreId={PLAY_STORE_ID} appStoreId={APP_STORE_ID} />
        {children}
      </body>
    </html>
  );
}
