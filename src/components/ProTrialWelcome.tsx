'use client';

import { useEffect, useState } from 'react';
import type { User } from '@supabase/supabase-js';
import { isInTrial } from '@/lib/proStatus';
import { useTranslation } from '@/contexts/LanguageProvider';

// Per-user, per-browser "seen" flag. Purely informational card, so localStorage
// (not a profiles column) is the right store — it may legitimately come back
// empty on another device and that just re-shows the card once.
const SEEN_PREFIX = 'immerse.proTrialWelcomeSeen.';

/**
 * One-time welcome card for a brand-new signed-in user who is inside their
 * 30-day Pro trial. Web has no post-signup step flow (its Onboarding.tsx is a
 * Settings-only tour), so this is the parity surface for the mobile STEP_TRIAL
 * screen. Self-gates: renders nothing unless `user` is in trial and the flag is
 * unset.
 */
export default function ProTrialWelcome({ user }: { user: User | null }) {
  const { t } = useTranslation();
  const [show, setShow] = useState(false);

  useEffect(() => {
    if (!user || !isInTrial(user.created_at)) return;
    let seen = false;
    try { seen = localStorage.getItem(SEEN_PREFIX + user.id) === '1'; } catch { /* private window */ }
    if (!seen) setShow(true);
  }, [user]);

  function dismiss() {
    if (user) { try { localStorage.setItem(SEEN_PREFIX + user.id, '1'); } catch { /* ignore */ } }
    setShow(false);
  }

  if (!show) return null;

  const features = [
    t('proTrialIntro.featureAiSummary'),
    t('proTrialIntro.featureImport'),
    t('proTrialIntro.featureVoices'),
  ];

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 px-4 py-6"
      onClick={dismiss}
    >
      <div
        className="relative bg-white dark:bg-[#1B2A38] rounded-2xl shadow-2xl w-full max-w-md p-6 sm:p-8"
        onClick={e => e.stopPropagation()}
      >
        <h2 className="text-xl font-bold text-gray-900 dark:text-[#E2EAF2] text-center">
          {t('proTrialIntro.title')}
        </h2>
        <p className="text-base font-semibold text-gray-900 dark:text-[#E2EAF2] text-center mt-3">
          {t('proTrialIntro.lede')}
        </p>
        <p className="text-sm text-gray-500 dark:text-[#8FA4B8] leading-relaxed mt-3">
          {t('proTrialIntro.body')}
        </p>
        <p className="text-sm font-semibold text-gray-900 dark:text-[#E2EAF2] mt-4">
          {t('proTrialIntro.priceLine')}
        </p>
        <ul className="mt-3 space-y-2">
          {features.map((line, i) => (
            <li key={i} className="flex gap-2 text-sm text-gray-500 dark:text-[#8FA4B8]">
              <span className="text-[#1B6B7B] dark:text-[#2D9DB3]">•</span>
              <span>{line}</span>
            </li>
          ))}
        </ul>
        <button
          onClick={dismiss}
          className="mt-6 w-full text-sm font-semibold bg-[#1B6B7B] dark:bg-[#2D9DB3] text-white px-5 py-2.5 rounded-xl hover:bg-[#155a68] dark:hover:bg-[#2589A0] transition-colors"
        >
          {t('proTrialIntro.cta')}
        </button>
      </div>
    </div>
  );
}
