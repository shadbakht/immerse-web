import Link from 'next/link';
import type { Metadata } from 'next';
import { supportContent, resolveLocale, type Locale } from '../legalContent';

export const metadata: Metadata = {
  title: 'Support — Immerse',
  description: 'Get help with Immerse: contact us, manage your account and subscription, and find answers to common questions.',
};

function Section({ title }: { title: string }) {
  return <h2 className="text-base font-bold text-gray-900 dark:text-[#E2EAF2] mt-8 mb-2">{title}</h2>;
}

function LangToggle({ locale, otherLabel }: { locale: Locale; otherLabel: string }) {
  const other = locale === 'es' ? '/support' : '/support?lang=es';
  return (
    <Link href={other} className="text-sm text-[#1B6B7B] dark:text-[#2D9DB3] hover:underline">
      {otherLabel}
    </Link>
  );
}

interface Props {
  searchParams: Promise<{ lang?: string }>;
}

export default async function SupportPage({ searchParams }: Props) {
  const { lang } = await searchParams;
  const locale = resolveLocale(lang);
  const c = supportContent[locale];
  const privacyHref = locale === 'es' ? '/privacy?lang=es' : '/privacy';

  return (
    <div className="min-h-screen bg-[#F8F7F4] dark:bg-[#0F1923]">
      <div className="max-w-2xl mx-auto px-6 py-12">
        <div className="flex items-center justify-between mb-8">
          <Link href="/" className="text-sm text-[#1B6B7B] dark:text-[#2D9DB3] hover:underline">{c.back}</Link>
          <LangToggle locale={locale} otherLabel={c.otherLanguage} />
        </div>

        <h1 className="text-3xl font-bold text-gray-900 dark:text-[#E2EAF2] mb-1">{c.title}</h1>
        <p className="text-sm text-gray-600 dark:text-[#8FA4B8] leading-relaxed mb-8">{c.intro}</p>

        {/* Contact card */}
        <div className="rounded-xl border border-gray-200 dark:border-[#2D4050] bg-white dark:bg-[#1B2A38] p-5 mb-2">
          <p className="text-xs font-bold tracking-widest uppercase text-gray-400 dark:text-[#5C7A8E] mb-2">{c.contactLabel}</p>
          <a
            href="mailto:support@immerseresearch.app"
            className="text-lg font-semibold text-[#1B6B7B] dark:text-[#2D9DB3] hover:underline"
          >
            support@immerseresearch.app
          </a>
        </div>

        {c.sections.map((s, i) => (
          <div key={i}>
            <Section title={s.title} />
            <p
              className="text-sm text-gray-600 dark:text-[#8FA4B8] leading-relaxed"
              dangerouslySetInnerHTML={{ __html: s.html }}
            />
          </div>
        ))}

        <Section title={c.privacyTermsTitle} />
        <p className="text-sm text-gray-600 dark:text-[#8FA4B8] leading-relaxed">
          {c.privacyLinkIntro}
          <Link href={privacyHref} className="text-[#1B6B7B] dark:text-[#2D9DB3] hover:underline">{c.privacyLinkText}</Link>.
        </p>
      </div>
    </div>
  );
}
