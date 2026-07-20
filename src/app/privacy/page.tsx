import Link from 'next/link';
import { legalContent, resolveLocale, type Locale, type LegalSection } from '../legalContent';

function Section({ title }: { title: string }) {
  return <h2 className="text-base font-bold text-gray-900 dark:text-[#E2EAF2] mt-8 mb-2">{title}</h2>;
}

// Renders one policy/terms section: a numbered heading, then its paragraphs,
// each optionally led by a bold label.
function Block({ section }: { section: LegalSection }) {
  return (
    <>
      <Section title={section.title} />
      {section.paras.map((p, i) => (
        <p
          key={i}
          className={`text-sm text-gray-600 dark:text-[#8FA4B8] leading-relaxed ${i < section.paras.length - 1 ? 'mb-2' : ''}`}
        >
          {p.label && <span className="font-semibold text-gray-700 dark:text-[#B8C7D6]">{p.label} — </span>}
          {p.text}
        </p>
      ))}
    </>
  );
}

// Language toggle — preserves the page, only flips ?lang.
function LangToggle({ locale, otherLabel }: { locale: Locale; otherLabel: string }) {
  const other = locale === 'es' ? '/privacy' : '/privacy?lang=es';
  return (
    <Link href={other} className="text-sm text-[#1B6B7B] dark:text-[#2D9DB3] hover:underline">
      {otherLabel}
    </Link>
  );
}

interface Props {
  searchParams: Promise<{ lang?: string }>;
}

export default async function PrivacyPage({ searchParams }: Props) {
  const { lang } = await searchParams;
  const locale = resolveLocale(lang);
  const c = legalContent[locale];

  return (
    <div className="min-h-screen bg-[#F8F7F4] dark:bg-[#0F1923]">
      <div className="max-w-2xl mx-auto px-6 py-12">
        <div className="flex items-center justify-between mb-8">
          <Link href="/" className="text-sm text-[#1B6B7B] dark:text-[#2D9DB3] hover:underline">{c.back}</Link>
          <LangToggle locale={locale} otherLabel={c.otherLanguage} />
        </div>

        <h1 className="text-3xl font-bold text-gray-900 dark:text-[#E2EAF2] mb-1">{c.legalHeading}</h1>
        <p className="text-sm text-gray-400 dark:text-[#5C7A8E] mb-10">{c.effectiveDate}</p>

        {/* ── Privacy Policy ── */}
        <h2 className="text-xl font-bold text-gray-900 dark:text-[#E2EAF2] mb-1">{c.privacyTitle}</h2>
        {c.privacyIntro.map((p, i) => (
          <p key={i} className={`text-sm text-gray-600 dark:text-[#8FA4B8] leading-relaxed ${i < c.privacyIntro.length - 1 ? 'mb-2' : 'mb-4'}`}>{p}</p>
        ))}
        {c.privacySections.map((s, i) => <Block key={i} section={s} />)}

        {/* ── Terms of Service ── */}
        <hr className="my-10 border-gray-200 dark:border-[#2D4050]" />
        <h2 className="text-xl font-bold text-gray-900 dark:text-[#E2EAF2] mb-1">{c.termsTitle}</h2>
        <p className="text-sm text-gray-600 dark:text-[#8FA4B8] leading-relaxed mb-4">{c.termsIntro}</p>
        {c.termsSections.map((s, i) => <Block key={i} section={s} />)}

        {/* ── Community Guidelines ── */}
        <hr className="my-10 border-gray-200 dark:border-[#2D4050]" />
        <h2 className="text-xl font-bold text-gray-900 dark:text-[#E2EAF2] mb-4">{c.guidelinesTitle}</h2>
        <p className="text-sm text-gray-600 dark:text-[#8FA4B8] leading-relaxed mb-4">{c.guidelinesIntro}</p>
        <div className="space-y-4 text-sm text-gray-600 dark:text-[#8FA4B8] leading-relaxed">
          {c.guidelines.map((g, i) => (
            <div key={i}>
              <p className="font-semibold text-gray-800 dark:text-[#D2DCE8]">{g.title}</p>
              <p>{g.text}</p>
            </div>
          ))}
        </div>

        <div className="mt-12 pt-6 border-t border-gray-200 dark:border-[#2D4050]">
          <Link href="/" className="text-sm text-[#1B6B7B] dark:text-[#2D9DB3] hover:underline">{c.back}</Link>
        </div>
      </div>
    </div>
  );
}
