'use client';

import { useEffect, useState, useCallback } from 'react';
import type { TranslationKey } from '@immerse/i18n';
import { useTranslation } from '@/contexts/LanguageProvider';

interface OnboardingProps {
  visible: boolean;
  onClose: () => void;
}

interface Step {
  img:        string;
  titleKey:   TranslationKey;
  captionKey: TranslationKey;
}

// Ordered intro screenshots (iPad onboarding set), copied to /public/onboarding.
// Module level, so the copy is carried as keys and resolved at render.
const STEPS: Step[] = [
  { img: '1-Library-main.png',                                titleKey: 'onboarding.libraryTitle',     captionKey: 'onboarding.libraryCaption' },
  { img: '2-Library-search-results.png',                      titleKey: 'onboarding.searchTitle',      captionKey: 'onboarding.searchCaption' },
  { img: '3-Library-search-reseults-quick-add-Tag-1.png',     titleKey: 'onboarding.tagAsYouGoTitle',  captionKey: 'onboarding.tagAsYouGoCaption' },
  { img: '4-Library-search-reseults-quick-add-Tag-2.png',     titleKey: 'onboarding.buildTagsTitle',   captionKey: 'onboarding.buildTagsCaption' },
  { img: '5-Reader-Screen-selecting-text-action-buttons.png', titleKey: 'onboarding.selectActTitle',   captionKey: 'onboarding.selectActCaption' },
  { img: '6-Reader-screen-annotations-in-margin.png',         titleKey: 'onboarding.marginTitle',      captionKey: 'onboarding.marginCaption' },
  { img: '7-Reader-screen-viewing-TOC.png',                   titleKey: 'onboarding.navigateTitle',    captionKey: 'onboarding.navigateCaption' },
  { img: '8-Tags-screen-main.png',                            titleKey: 'onboarding.yourTagsTitle',    captionKey: 'onboarding.yourTagsCaption' },
  { img: '9-Xref-screen.png',                                 titleKey: 'onboarding.xrefsTitle',       captionKey: 'onboarding.xrefsCaption' },
  { img: '10-Share-Tag-screen.png',                           titleKey: 'onboarding.shareTitle',       captionKey: 'onboarding.shareCaption' },
];

export default function Onboarding({ visible, onClose }: OnboardingProps) {
  const { t } = useTranslation();
  const [i, setI] = useState(0);
  const last = STEPS.length - 1;

  // Reset to the first slide each time it's opened.
  useEffect(() => { if (visible) setI(0); }, [visible]);

  const go = useCallback((next: number) => setI(prev => Math.max(0, Math.min(last, next ?? prev))), [last]);

  useEffect(() => {
    if (!visible) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === 'ArrowRight') setI(p => Math.min(last, p + 1));
      else if (e.key === 'ArrowLeft') setI(p => Math.max(0, p - 1));
      else if (e.key === 'Escape') onClose();
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [visible, last, onClose]);

  if (!visible) return null;
  const step = STEPS[i];

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 px-4 py-6" onClick={onClose}>
      <div
        className="relative bg-white dark:bg-[#1B2A38] rounded-2xl shadow-2xl w-full max-w-3xl max-h-full flex flex-col overflow-hidden"
        onClick={e => e.stopPropagation()}
      >
        {/* Close */}
        <button
          onClick={onClose}
          className="absolute top-3 right-3 z-10 w-8 h-8 flex items-center justify-center rounded-full bg-black/5 text-gray-500 dark:text-[#8FA4B8] hover:bg-black/10 transition-colors"
          aria-label={t('onboarding.closeIntro')}
        >
          ✕
        </button>

        {/* Screenshot */}
        <div className="flex-1 min-h-0 bg-gray-50 dark:bg-[#243040] flex items-center justify-center p-4">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={`/onboarding/${step.img}`}
            alt={t(step.titleKey)}
            className="max-w-full max-h-[55vh] object-contain rounded-lg shadow-sm border border-gray-200 dark:border-[#2D4050]"
          />
        </div>

        {/* Caption + controls */}
        <div className="shrink-0 px-6 pt-4 pb-5 border-t border-gray-100 dark:border-[#2D4050]">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-[#E2EAF2] text-center">{t(step.titleKey)}</h3>
          <p className="text-sm text-gray-500 dark:text-[#8FA4B8] text-center mt-1 leading-relaxed min-h-[2.5rem]">{t(step.captionKey)}</p>

          {/* Dots */}
          <div className="flex justify-center gap-1.5 mt-3">
            {STEPS.map((_, idx) => (
              <button
                key={idx}
                onClick={() => go(idx)}
                aria-label={t('onboarding.goToStep', { number: idx + 1 })}
                className={`h-1.5 rounded-full transition-all ${idx === i ? 'w-5 bg-[#1B6B7B] dark:bg-[#2D9DB3]' : 'w-1.5 bg-gray-300 hover:bg-gray-400 dark:hover:bg-[#3F5468]'}`}
              />
            ))}
          </div>

          {/* Buttons */}
          <div className="flex items-center justify-between gap-3 mt-4">
            <button
              onClick={() => go(i - 1)}
              disabled={i === 0}
              className="text-sm text-gray-500 dark:text-[#8FA4B8] font-medium px-4 py-2 rounded-xl hover:bg-gray-100 dark:hover:bg-[#2D4050] transition-colors disabled:opacity-0"
            >
              ← {t('common.back')}
            </button>
            {i < last ? (
              <button
                onClick={() => go(i + 1)}
                className="text-sm font-semibold bg-[#1B6B7B] dark:bg-[#2D9DB3] text-white px-5 py-2 rounded-xl hover:bg-[#155a68] dark:hover:bg-[#2589A0] transition-colors"
              >
                {t('common.next')} →
              </button>
            ) : (
              <button
                onClick={onClose}
                className="text-sm font-semibold bg-[#1B6B7B] dark:bg-[#2D9DB3] text-white px-5 py-2 rounded-xl hover:bg-[#155a68] dark:hover:bg-[#2589A0] transition-colors"
              >
                {t('common.done')}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
