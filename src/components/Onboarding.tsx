'use client';

import { useEffect, useState, useCallback } from 'react';

interface OnboardingProps {
  visible: boolean;
  onClose: () => void;
}

interface Step {
  img:     string;
  title:   string;
  caption: string;
}

// Ordered intro screenshots (iPad onboarding set), copied to /public/onboarding.
const STEPS: Step[] = [
  { img: '1-Library-main.png',                          title: 'The Library',        caption: 'Browse a curated, multi-tradition library. Tap any book to start reading.' },
  { img: '2-Library-search-results.png',                title: 'Search everything',  caption: 'Search across every book at once and jump straight to the passage.' },
  { img: '3-Library-search-reseults-quick-add-Tag-1.png', title: 'Tag as you go',    caption: 'Add a tag to a passage right from the search results.' },
  { img: '4-Library-search-reseults-quick-add-Tag-2.png', title: 'Build your tags',  caption: 'Group passages under your own tags for easy recall.' },
  { img: '5-Reader-Screen-selecting-text-action-buttons.png', title: 'Select & act', caption: 'Select any text to highlight, tag, note, or cross-reference it.' },
  { img: '6-Reader-screen-annotations-in-margin.png',   title: 'Margin annotations', caption: 'Your tags, notes, and cross-references live in the margin.' },
  { img: '7-Reader-screen-viewing-TOC.png',             title: 'Navigate quickly',   caption: 'Open the table of contents to move around a book.' },
  { img: '8-Tags-screen-main.png',                      title: 'Your tags',          caption: 'Revisit every tagged passage, organized by tag.' },
  { img: '9-Xref-screen.png',                           title: 'Cross-references',   caption: 'Link related passages across books and traditions.' },
  { img: '10-Share-Tag-screen.png',                     title: 'Share & publish',    caption: 'Share a quote or publish a tag for the community.' },
];

export default function Onboarding({ visible, onClose }: OnboardingProps) {
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
          aria-label="Close intro"
        >
          ✕
        </button>

        {/* Screenshot */}
        <div className="flex-1 min-h-0 bg-gray-50 dark:bg-[#243040] flex items-center justify-center p-4">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={`/onboarding/${step.img}`}
            alt={step.title}
            className="max-w-full max-h-[55vh] object-contain rounded-lg shadow-sm border border-gray-200 dark:border-[#2D4050]"
          />
        </div>

        {/* Caption + controls */}
        <div className="shrink-0 px-6 pt-4 pb-5 border-t border-gray-100 dark:border-[#2D4050]">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-[#E2EAF2] text-center">{step.title}</h3>
          <p className="text-sm text-gray-500 dark:text-[#8FA4B8] text-center mt-1 leading-relaxed min-h-[2.5rem]">{step.caption}</p>

          {/* Dots */}
          <div className="flex justify-center gap-1.5 mt-3">
            {STEPS.map((_, idx) => (
              <button
                key={idx}
                onClick={() => go(idx)}
                aria-label={`Go to step ${idx + 1}`}
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
              ← Back
            </button>
            {i < last ? (
              <button
                onClick={() => go(i + 1)}
                className="text-sm font-semibold bg-[#1B6B7B] dark:bg-[#2D9DB3] text-white px-5 py-2 rounded-xl hover:bg-[#155a68] dark:hover:bg-[#2589A0] transition-colors"
              >
                Next →
              </button>
            ) : (
              <button
                onClick={onClose}
                className="text-sm font-semibold bg-[#1B6B7B] dark:bg-[#2D9DB3] text-white px-5 py-2 rounded-xl hover:bg-[#155a68] dark:hover:bg-[#2589A0] transition-colors"
              >
                Done
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
