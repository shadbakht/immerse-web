'use client';

import { useId } from 'react';
import { useTranslation } from '@/contexts/LanguageProvider';
import ReadingRing from './ReadingRing';

/**
 * The end-of-book panel: the reading ring sweeping closed into a check,
 * "You finished {title}", then "Choose your next book" (the Library) and
 * "Done". Web twin of mobile BookFinishedPopup (without the reading-plan line:
 * the web has no reading plan).
 */
export default function BookFinishedDialog({
  title, onChooseNext, onDone,
}: { title: string; onChooseNext: () => void; onDone: () => void }) {
  const { t } = useTranslation();
  // Its own ring identity, so the ring sweeps closed when the panel opens.
  const ringKey = `book-finished:${title}:${useId()}`;
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-[rgba(28,43,53,0.28)] px-4"
      onClick={onDone}
      role="dialog"
      aria-modal="true"
    >
      <div
        className="flex w-full max-w-xs flex-col items-center rounded-2xl bg-white/95 px-7 py-6 text-center shadow-xl backdrop-blur dark:bg-[#1B2A38]/95"
        onClick={(e) => e.stopPropagation()}
      >
        <ReadingRing fraction={1} ringKey={ringKey} size={64} />
        <p className="mt-3 text-[17px] font-semibold text-gray-900 dark:text-[#E2EAF2]">
          {title ? t('plan.youFinished', { title }) : t('plan.readingComplete')}
        </p>
        <button
          onClick={onChooseNext}
          className="mt-4 rounded-xl bg-[#1B6B7B] px-5 py-2.5 text-sm font-semibold text-white hover:bg-[#165a68] dark:bg-[#2D9DB3] dark:hover:bg-[#2789a0]"
        >
          {t('plan.chooseNextBook')}
        </button>
        <button
          onClick={onDone}
          className="mt-2.5 px-3 py-1 text-sm font-semibold text-[#1B6B7B] dark:text-[#2D9DB3]"
        >
          {t('common.done')}
        </button>
      </div>
    </div>
  );
}
