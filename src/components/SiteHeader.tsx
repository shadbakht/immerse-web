import Link from 'next/link';
import Image from 'next/image';
import LanguageMenu, { type LanguageLink } from './LanguageMenu';

/**
 * Top bar for the standalone pages (/get, /privacy, /support): the app icon,
 * linking home to immerseresearch.app, and the language picker.
 */
export default function SiteHeader({
  homeLabel, languageLabel, languages, currentLanguage,
}: {
  homeLabel: string;
  languageLabel: string;
  languages: LanguageLink[];
  currentLanguage: string;
}) {
  return (
    <div className="flex items-center justify-between">
      <Link href="/" aria-label={homeLabel} title={homeLabel} className="block rounded-[10px] shadow-[0_1px_3px_rgba(0,0,0,0.15)] hover:opacity-90 transition-opacity">
        <Image src="/immerse-icon.png" alt="" width={40} height={40} className="rounded-[10px]" priority />
      </Link>
      <LanguageMenu links={languages} current={currentLanguage} label={languageLabel} />
    </div>
  );
}
