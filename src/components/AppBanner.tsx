'use client';

import { useEffect, useState } from 'react';
import Image from 'next/image';

interface AppBannerProps {
  playStoreId: string;   // e.g. "com.shadbakht.immerse" — empty = hidden
  appStoreId:  string;   // e.g. "6478293847"            — empty = hidden
                         // (Real Safari gets the native Smart App Banner via the
                         //  apple-itunes-app meta tag in layout.tsx. This component
                         //  shows a custom banner on Android and on non-Safari iOS
                         //  browsers — Chrome/Firefox/Edge/Brave — which ignore that tag.)
}

export default function AppBanner({ playStoreId, appStoreId }: AppBannerProps) {
  const [visible, setVisible] = useState(false);
  const [platform, setPlatform] = useState<'android' | 'ios' | null>(null);

  useEffect(() => {
    // Don't show if dismissed this session
    if (sessionStorage.getItem('app_banner_dismissed')) return;

    const ua = navigator.userAgent;
    const isAndroid = /android/i.test(ua);
    const isIos     = /iphone|ipad|ipod/i.test(ua);

    if (isAndroid && playStoreId) {
      setPlatform('android');
      setVisible(true);
      return;
    }

    if (isIos && appStoreId) {
      // Real Safari renders the native Smart App Banner via the apple-itunes-app
      // meta tag, so we defer to it there. Every OTHER iOS browser ignores that
      // tag, so we must show our own banner instead.
      //   - Chrome/Firefox/Edge/Opera carry a distinct UA token (CriOS, etc.).
      //   - Brave deliberately uses a Safari-identical UA, so UA sniffing can't
      //     catch it — detect it via the navigator.brave.isBrave() API.
      const knownNonSafari = /crios|fxios|edgios|opios/i.test(ua);

      (async () => {
        let isBrave = false;
        try {
          const brave = (navigator as unknown as { brave?: { isBrave?: () => Promise<boolean> } }).brave;
          if (brave?.isBrave) isBrave = await brave.isBrave();
        } catch { /* navigator.brave unavailable — treat as Safari */ }

        if (knownNonSafari || isBrave) {
          setPlatform('ios');
          setVisible(true);
        }
      })();
    }
  }, [playStoreId, appStoreId]);

  function dismiss() {
    sessionStorage.setItem('app_banner_dismissed', '1');
    setVisible(false);
  }

  function openStore() {
    if (platform === 'android' && playStoreId) {
      window.open(`https://play.google.com/store/apps/details?id=${playStoreId}`, '_blank');
    } else if (platform === 'ios' && appStoreId) {
      window.open(`https://apps.apple.com/app/id${appStoreId}`, '_blank');
    }
  }

  if (!visible) return null;

  return (
    <div className="flex items-center gap-3 px-4 py-3 bg-[#1C2B35] text-white w-full z-50">
      {/* App icon */}
      <div className="w-12 h-12 rounded-xl overflow-hidden shrink-0 shadow-md">
        <Image src="/immerse-icon.png" alt="Immerse" width={48} height={48} />
      </div>

      {/* Text */}
      <div className="flex-1 min-w-0">
        <div className="text-sm font-semibold leading-tight">Immerse</div>
        <div className="text-xs text-white/60 mt-0.5">
          {platform === 'android' ? 'Get it on Google Play' : 'Download on the App Store'}
        </div>
      </div>

      {/* Open button */}
      <button
        onClick={openStore}
        className="shrink-0 bg-[#1B6B7B] text-white text-xs font-semibold px-4 py-2 rounded-xl hover:bg-[#155a68] transition-colors"
      >
        {platform === 'android' ? 'Install' : 'Open'}
      </button>

      {/* Dismiss */}
      <button
        onClick={dismiss}
        className="shrink-0 text-white/40 hover:text-white/80 transition-colors text-lg leading-none ml-1"
        aria-label="Dismiss"
      >
        ✕
      </button>
    </div>
  );
}
