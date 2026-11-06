import Link from 'next/link';
import Image from 'next/image';
import type { Metadata } from 'next';
import { headers } from 'next/headers';
import { directionOf } from '@immerse/i18n';
import SiteHeader from '@/components/SiteHeader';
import { SITE_URL } from '@/lib/siteUrl';
import { APP_STORE_URL, PLAY_STORE_URL } from '@/lib/storeLinks';
import { getContent, GET_LANGUAGES, resolveGetLocale } from './content';
import CopyLinkButton from './CopyLinkButton';

// /get — one link to hand to friends without knowing their phone: both store
// buttons, ordered for the visitor's platform, plus a way to pass it on.

interface Props {
  searchParams: Promise<{ lang?: string | string[] }>;
}

async function localeFor(searchParams: Props['searchParams']) {
  const { lang } = await searchParams;
  const h = await headers();
  return resolveGetLocale(lang, h.get('accept-language'));
}

export async function generateMetadata({ searchParams }: Props): Promise<Metadata> {
  const c = getContent[await localeFor(searchParams)];
  return {
    title: { absolute: c.metaTitle },
    description: c.metaDescription,
    alternates: { canonical: '/get' },
    openGraph: {
      title: c.metaTitle,
      description: c.metaDescription,
      url: `${SITE_URL}/get`,
      siteName: 'Immerse Research',
      type: 'website',
      images: [{ url: '/immerse-icon.png', width: 1024, height: 1024 }],
    },
    twitter: { card: 'summary', title: c.metaTitle, description: c.metaDescription, images: ['/immerse-icon.png'] },
  };
}

function AppleLogo() {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className="w-9 h-9 shrink-0" aria-hidden>
      <path d="M16.37 12.6c-.02-2.3 1.88-3.4 1.96-3.46-1.07-1.56-2.73-1.78-3.32-1.8-1.41-.14-2.76.83-3.47.83-.72 0-1.82-.81-3-.79-1.54.02-2.96.9-3.75 2.27-1.6 2.78-.41 6.9 1.15 9.15.76 1.1 1.67 2.34 2.86 2.3 1.15-.05 1.58-.74 2.97-.74 1.38 0 1.77.74 2.98.72 1.23-.02 2.01-1.12 2.76-2.23.87-1.28 1.23-2.52 1.25-2.58-.03-.01-2.4-.92-2.42-3.66zM14.1 5.84c.63-.77 1.06-1.83.94-2.89-.91.04-2.01.61-2.66 1.37-.58.67-1.09 1.75-.96 2.79 1.02.08 2.05-.52 2.68-1.27z" />
    </svg>
  );
}

function PlayLogo() {
  return (
    <svg viewBox="0 0 24 24" className="w-9 h-9 shrink-0" aria-hidden>
      <path fill="#34A853" d="M3.6 2.3 13.7 12 3.6 21.7c-.36-.2-.6-.6-.6-1.1V3.4c0-.5.24-.9.6-1.1z" />
      <path fill="#FBBC04" d="m17.1 8.6-3.4 3.4 3.4 3.4 3.8-2.2c.7-.4.7-1.4 0-1.8z" />
      <path fill="#EA4335" d="M13.7 12 3.6 21.7c.3.2.8.2 1.2 0l12.3-6.3z" />
      <path fill="#4285F4" d="M3.6 2.3c.4-.2.9-.2 1.2 0l12.3 6.3-3.4 3.4z" />
    </svg>
  );
}

function StoreButton({ href, small, big, logo }: { href: string; small: string; big: string; logo: React.ReactNode }) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      // Badges stay left-to-right in every locale: the store names are Latin.
      dir="ltr"
      className="flex items-center gap-3 h-16 px-5 rounded-xl bg-black text-white border border-[#444] hover:bg-[#1a1a1a] transition-colors w-full sm:w-60"
    >
      {logo}
      <span className="min-w-0 text-start">
        <span className="block text-[11px] leading-tight opacity-85 truncate">{small}</span>
        <span className="block text-[20px] font-semibold leading-tight">{big}</span>
      </span>
    </a>
  );
}

export default async function GetPage({ searchParams }: Props) {
  const locale = await localeFor(searchParams);
  const c = getContent[locale];
  const dir = directionOf(locale);

  const ua = (await headers()).get('user-agent') ?? '';
  const androidFirst = /android/i.test(ua);

  const apple = <StoreButton key="ios" href={APP_STORE_URL} small={c.appStoreSmall} big="App Store" logo={<AppleLogo />} />;
  const play = <StoreButton key="android" href={PLAY_STORE_URL} small={c.playSmall} big="Google Play" logo={<PlayLogo />} />;

  const languages = GET_LANGUAGES.map(l => ({ ...l, href: `/get?lang=${l.code}` }));

  return (
    <div lang={locale} dir={dir} className="min-h-screen bg-[#F8F7F4] dark:bg-[#0F1923] flex flex-col">
      <div className="w-full max-w-5xl mx-auto px-5 sm:px-7 pt-5 sm:pt-6">
        <SiteHeader homeLabel={c.home} languageLabel={c.language} languages={languages} currentLanguage={locale} />
      </div>

      <main className="flex-1 flex flex-col items-center text-center px-6 pt-12 sm:pt-16 pb-10">
        <Image
          src="/immerse-icon.png"
          alt=""
          width={128}
          height={128}
          priority
          className="w-28 h-28 sm:w-32 sm:h-32 rounded-[26px] sm:rounded-[29px] shadow-[0_8px_24px_rgba(0,0,0,0.18)]"
        />
        <h1 dir="ltr" className="mt-5 text-[28px] sm:text-4xl font-bold text-gray-900 dark:text-[#E2EAF2]">Immerse Research</h1>
        <p className="mt-2 text-[15px] sm:text-[17px] leading-relaxed text-gray-600 dark:text-[#8FA4B8]">
          {c.tagline}<br className="sm:hidden" /> {c.availability}
        </p>

        <div className="mt-9 flex flex-col sm:flex-row gap-3 sm:gap-4 w-full max-w-xs sm:max-w-none sm:w-auto">
          {androidFirst ? [play, apple] : [apple, play]}
        </div>

        <p className="mt-6 text-sm text-gray-700 dark:text-[#B8C7D6]">
          {c.or}{' '}
          <Link href="/" className="font-semibold text-[#1B6B7B] dark:text-[#2D9DB3] hover:underline">
            {c.readInBrowser} {dir === 'rtl' ? '←' : '→'}
          </Link>
        </p>

        <div className="mt-auto pt-12">
          <CopyLinkButton url={`${SITE_URL}/get`} label={c.copyLink} copiedLabel={c.copied} shareText={c.metaDescription} />
        </div>
      </main>
    </div>
  );
}
