'use client';

import { useState } from 'react';
import { useTranslation } from '@/contexts/LanguageProvider';
import { quoteCardOverage } from '@/lib/quoteCardLimit';

/**
 * Shown instead of the quote card when the selection is past the card's
 * character limit (lib/quoteCardLimit): says so, and offers the passage as
 * text — through the share sheet where the browser has one, otherwise copied
 * to the clipboard. Mirrors the mobile reader's alert. Cancel (or a click
 * outside) leaves the reader's selection in place; sharing ends it.
 */
export default function ShareTooLongDialog({
  text, citation, language, onCancel, onShared,
}: {
  text: string;
  citation: string;
  language: string | null | undefined;
  onCancel: () => void;
  onShared: () => void;
}) {
  const { t } = useTranslation();
  const [copied, setCopied] = useState(false);

  async function shareAsText() {
    const body = `“${text.trim()}”${citation ? `\n${citation}` : ''}`;
    if (typeof navigator.share === 'function') {
      try { await navigator.share({ text: body }); onShared(); return; } catch { /* dismissed or blocked: fall back to copying */ }
    }
    try {
      await navigator.clipboard.writeText(body);
      setCopied(true);
      setTimeout(onShared, 1200);
    } catch { onShared(); }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-[rgba(28,43,53,0.28)] px-4"
      onClick={onCancel}
      role="dialog"
      aria-modal="true"
    >
      <div
        className="w-full max-w-sm rounded-2xl bg-white px-6 py-5 text-center shadow-xl dark:bg-[#1B2A38]"
        onClick={(e) => e.stopPropagation()}
      >
        <p className="text-[17px] font-semibold text-gray-900 dark:text-[#E2EAF2]">{t('reader.shareTooLongTitle')}</p>
        <p className="mt-2 text-sm leading-relaxed text-gray-600 dark:text-[#9FB3C3]">
          {t('reader.shareTooLongBody', quoteCardOverage(text, language))}
        </p>
        <div className="mt-5 flex justify-center gap-3">
          <button
            onClick={onCancel}
            className="rounded-xl px-4 py-2 text-sm font-semibold text-[#1B6B7B] hover:bg-[#1B6B7B]/10 dark:text-[#2D9DB3]"
          >
            {t('common.cancel')}
          </button>
          <button
            onClick={shareAsText}
            className="rounded-xl bg-[#1B6B7B] px-4 py-2 text-sm font-semibold text-white hover:bg-[#165a68] dark:bg-[#2D9DB3] dark:hover:bg-[#2789a0]"
          >
            {copied ? t('ai.copied') : t('reader.shareAsText')}
          </button>
        </div>
      </div>
    </div>
  );
}
