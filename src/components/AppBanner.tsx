'use client';

import { useEffect, useState } from 'react';
import Image from 'next/image';
import { useTranslation } from '@/contexts/LanguageProvider';

interface AppBannerProps {
  playStoreId: string;   // e.g. "com.shadbakht.immerse" — empty = hidden
  appStoreId:  string;   // e.g. "6478293847"            — empty = hidden
                         // Shows on every mobile browser (Android + all iOS browsers,
                         // Safari included). The button routes to the store listing.
}

export default function AppBanner({ playStoreId, appStoreId }: AppBannerProps) {
  const { t } = useTranslation();
  const [visible, setVisible] = useState(false);
  const [platform, setPlatform] = useState<'android' | 'ios' | null>(null);

  useEffect(() => {
    // Don't show if dismissed this session
    if (sessionStorage.getItem('app_banner_dismissed')) return;

    // Show on every mobile browser regardless of whether the app is installed.
    // The button routes to the store listing, which itself shows "Open" if the
    // app is installed or "Get" if not — so we don't need to detect install
    // state (which iOS browsers can't do reliably anyway).
    const ua = navigator.userAgent;
    const isAndroid = /android/i.test(ua);
    const isIos     = /iphone|ipad|ipod/i.test(ua);

    if (isAndroid && playStoreId) {
      setPlatform('android');
      setVisible(true);
    } else if (isIos && appStoreId) {
      setPlatform('ios');
      setVisible(true);
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
    <div className="flex items-center gap-3.5 px-5 py-3.5 bg-[#1C2B35] text-white w-full z-50">
      {/* App icon */}
      <div className="w-14 h-14 rounded-2xl overflow-hidden shrink-0 shadow-md">
        <Image src="/immerse-icon.png" alt="Immerse" width={56} height={56} />
      </div>

      {/* Text */}
      <div className="flex-1 min-w-0">
        <div className="text-base font-semibold leading-tight">Immerse</div>
        <div className="text-sm text-white/60 mt-1">
          {platform === 'android' ? t('banner.googlePlay') : t('banner.appStore')}
        </div>
      </div>

      {/* Open button */}
      <button
        onClick={openStore}
        className="shrink-0 bg-[#1B6B7B] dark:bg-[#2D9DB3] text-white text-sm font-semibold px-5 py-2.5 rounded-xl hover:bg-[#155a68] dark:hover:bg-[#2589A0] transition-colors"
      >
        {platform === 'android' ? t('banner.install') : t('banner.get')}
      </button>

      {/* Dismiss */}
      <button
        onClick={dismiss}
        className="shrink-0 text-white/40 hover:text-white/80 transition-colors text-xl leading-none ml-1.5"
        aria-label={t('common.dismiss')}
      >
        ✕
      </button>
    </div>
  );
}
