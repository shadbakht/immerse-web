/**
 * "12 min left in chapter" for the web Home's Recently Viewed rows. The web
 * twin of mobile `src/reader/chapterTimeLeft.ts` (pace table and wording kept
 * equal — change both).
 *
 * The web has no TOC-depth chapter model on Home, so a chapter here is the run
 * of passages sharing the reading position's `chapter_label` (one chunk, which
 * is how the corpus splits books into chapters). Words are counted from the
 * passage at the reading position to the end of that run.
 */

import type { TranslationKey, TranslateVars } from '@immerse/i18n';

/**
 * Average reading pace in words per minute (Chinese: characters per minute),
 * from the IReST study of 17 languages (Trauzettel-Klosinski & Dietz, 2012).
 * Persian borrows the Arabic figure; any other language reads at the English
 * pace. Same table as mobile.
 */
const PACE: Record<string, number> = {
  en: 228, es: 218, fr: 195, ru: 184, pt: 181, de: 179, tr: 166,
  hi: 150, ar: 138, fa: 138, zh: 255,
};

export function paceFor(language: string | null | undefined): number {
  const base = (language ?? '').toLowerCase().split(/[-_]/)[0];
  return PACE[base] ?? PACE.en;
}

/** Chinese and Japanese are paced in characters; everything else in words. */
export function countReadingUnits(text: string, language: string | null | undefined): number {
  const base = (language ?? '').toLowerCase().split(/[-_]/)[0];
  const plain = text.replace(/<[^>]*>/g, ' ').replace(/\[\d+\]/g, ' ');
  if (base === 'zh' || base === 'ja') return plain.replace(/\s+/g, '').length;
  const words = plain.trim().split(/\s+/);
  return words[0] === '' ? 0 : words.length;
}

type Translate = (key: TranslationKey, vars?: TranslateVars) => string;

/** A whole number of minutes in the interface language: "12 min", "1 h", "1 h 30 min". */
export function formatMinutes(t: Translate, totalMinutes: number): string {
  const total = Math.max(0, Math.round(totalMinutes));
  if (total < 60) return t('reader.durationMinutes', { minutes: total });
  const hours = Math.floor(total / 60);
  const minutes = total % 60;
  return minutes === 0
    ? t('reader.durationHours', { hours })
    : t('reader.durationHoursMinutes', { hours, minutes });
}

/** "12 min left in chapter" / "Less than a minute left in chapter". */
export function describeTimeLeft(t: Translate, units: number, language: string | null | undefined): string {
  const exact = units / paceFor(language);
  if (exact < 1) return t('reader.underMinuteLeftInChapter');
  return t('reader.timeLeftInChapter', { time: formatMinutes(t, exact) });
}
