'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { useTranslation } from '@/contexts/LanguageProvider';

// Pivot page for mobile-app signup confirmations.
//
// A mobile signup sets emailRedirectTo to this page. Supabase verifies the
// email server-side, then redirects here with the session tokens in the URL
// fragment (#access_token=...&refresh_token=...). We then:
//   • On a phone: re-open the native app via immerse://confirm#<tokens>, which
//     calls setSession and signs the user in automatically.
//   • On desktop / no app: show the normal "email confirmed" fallback so the
//     account is still usable on the web.
// The email is already confirmed by the time we land here — the tokens only
// provide the convenience of an auto sign-in inside the app.

const APP_SCHEME = 'immerse://confirm';

function isMobile(): boolean {
  if (typeof navigator === 'undefined') return false;
  return /iphone|ipad|ipod|android/i.test(navigator.userAgent);
}

export default function AppConfirmPage() {
  const { t } = useTranslation();
  const [mobile, setMobile] = useState(false);

  // The fragment carries the tokens; forward it verbatim to the app.
  function appUrl(): string {
    const hash = typeof window !== 'undefined' ? window.location.hash : '';
    return hash ? `${APP_SCHEME}${hash}` : APP_SCHEME;
  }

  useEffect(() => {
    if (!isMobile()) return;
    setMobile(true);
    // Auto-attempt the hand-off into the app.
    window.location.href = appUrl();
  }, []);

  return (
    <div className="min-h-screen bg-[#0F1923] flex items-center justify-center px-4">
      <div className="w-full max-w-sm text-center">
        <div className="flex justify-center mb-6">
          <Image src="/immerse-icon.png" alt="Immerse" width={72} height={72} className="rounded-2xl" />
        </div>
        <div className="text-5xl mb-4">✅</div>
        <h1 className="text-2xl font-bold text-white mb-3">{t('auth.emailConfirmed')}</h1>

        {mobile ? (
          <>
            <p className="text-gray-400 dark:text-[#5C7A8E] text-sm leading-relaxed mb-8">
              {t('auth.openingApp')}
            </p>
            <a
              href={appUrl()}
              className="block w-full bg-[#1B6B7B] dark:bg-[#2D9DB3] text-white font-semibold py-3.5 rounded-xl hover:bg-[#155a68] dark:hover:bg-[#2589A0] transition-colors text-sm"
            >
              {t('auth.openImmerse')}
            </a>
            <Link
              href="/login"
              className="block w-full text-gray-400 dark:text-[#5C7A8E] text-sm py-3 mt-1 hover:text-white transition-colors"
            >
              {t('auth.continueOnWeb')}
            </Link>
          </>
        ) : (
          <>
            <p className="text-gray-400 dark:text-[#5C7A8E] text-sm leading-relaxed mb-8">
              {t('auth.accountReadyOpenApp')}
            </p>
            <Link
              href="/login"
              className="block w-full bg-[#1B6B7B] dark:bg-[#2D9DB3] text-white font-semibold py-3.5 rounded-xl hover:bg-[#155a68] dark:hover:bg-[#2589A0] transition-colors text-sm"
            >
              {t('auth.signInToImmerse')}
            </Link>
          </>
        )}
      </div>
    </div>
  );
}
