'use client';

// Discover "Report …": pick a reason, then a thank-you (Apple guideline 1.2).
// Mirrors mobile's ModerationSheet reason list.

import { useState } from 'react';
import { createPortal } from 'react-dom';
import { useTranslation } from '@/contexts/LanguageProvider';
import { REPORT_REASONS, type ReportKind, type ReportReason } from '@/lib/moderation';
import type { TranslationKey } from '@immerse/i18n';

const REASON_KEY: Record<ReportReason, TranslationKey> = {
  offensive: 'moderation.reasonOffensive',
  harassment: 'moderation.reasonHarassment',
  spam: 'moderation.reasonSpam',
  image: 'moderation.reasonImage',
  other: 'moderation.reasonOther',
};

export function ReportDialog({ kind, onSubmit, onClose }: {
  kind: ReportKind;
  /** Resolves when the report is saved; throws on failure. */
  onSubmit: (reason: ReportReason) => Promise<void>;
  onClose: () => void;
}) {
  const { t } = useTranslation();
  const [state, setState] = useState<'pick' | 'sending' | 'done' | 'failed'>('pick');

  async function pick(reason: ReportReason) {
    setState('sending');
    try { await onSubmit(reason); setState('done'); } catch { setState('failed'); }
  }

  if (typeof document === 'undefined') return null;
  return createPortal(
    <div className="fixed inset-0 z-[10000] flex items-center justify-center bg-black/40 p-4" onMouseDown={onClose}>
      <div role="dialog" aria-modal="true" onMouseDown={e => e.stopPropagation()}
        className="w-full max-w-sm bg-white dark:bg-[#1B2A38] rounded-xl shadow-xl border border-gray-200 dark:border-[#2D4050] overflow-hidden">
        {state === 'done' || state === 'failed' ? (
          <div className="p-5">
            {state === 'done' && <div className="font-semibold text-gray-900 dark:text-[#E2EAF2] mb-2">{t('moderation.reportThanksTitle')}</div>}
            <p className="text-sm text-gray-600 dark:text-[#8FA4B8]">
              {state === 'done' ? t('moderation.reportThanksBody') : t('moderation.reportFailed')}
            </p>
            <div className="flex justify-end mt-4">
              <button onClick={onClose} className="text-sm font-semibold text-[#1B6B7B] dark:text-[#2D9DB3] px-3 py-1.5">{t('common.ok')}</button>
            </div>
          </div>
        ) : (
          <>
            <div className="px-5 pt-4 pb-2 text-sm text-gray-500 dark:text-[#8FA4B8]">{t('moderation.reasonTitle')}</div>
            {REPORT_REASONS.filter(r => r !== 'image' || kind === 'user').map(r => (
              <button key={r} disabled={state === 'sending'} onClick={() => pick(r)}
                className="w-full text-start px-5 py-3 text-sm text-gray-800 dark:text-[#D2DCE8] hover:bg-gray-50 dark:hover:bg-[#243040] border-t border-gray-100 dark:border-[#2D4050] disabled:opacity-50">
                {t(REASON_KEY[r])}
              </button>
            ))}
            <button onClick={onClose}
              className="w-full text-start px-5 py-3 text-sm text-gray-500 dark:text-[#8FA4B8] hover:bg-gray-50 dark:hover:bg-[#243040] border-t border-gray-100 dark:border-[#2D4050]">
              {t('common.cancel')}
            </button>
          </>
        )}
      </div>
    </div>,
    document.body,
  );
}
