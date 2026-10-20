'use client';

import { useTranslation } from '@/contexts/LanguageProvider';

interface Props {
  text: string;
  onClose: () => void;
  /** Placement: the caller puts it beside the thing it explains. */
  className?: string;
}

/**
 * A one-time tip, shown where the thing it explains first comes up (a new
 * margin marker, the Library's search). The welcome tour covers only three
 * screens; these teach the rest in place (lib/useFirstUseHint remembers which
 * have been shown). Mirrors mobile's components/FirstUseHint: a lightbulb, a
 * line of text, a close button.
 */
export default function FirstUseHint({ text, onClose, className = '' }: Props) {
  const { t } = useTranslation();
  return (
    <div
      role="status"
      className={`flex items-center gap-2.5 px-3.5 py-2.5 rounded-xl bg-gray-50 dark:bg-[#15212C] border border-gray-100 dark:border-[#2D4050] shadow-sm ${className}`}
    >
      {/* lucide `lightbulb`, as on mobile */}
      <svg
        width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}
        strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"
        className="shrink-0 text-[#1B6B7B] dark:text-[#2D9DB3]"
      >
        <path d="M15 14c.2-1 .7-1.7 1.5-2.5 1-.9 1.5-2.2 1.5-3.5A6 6 0 0 0 6 8c0 1 .2 2.2 1.5 3.5.7.7 1.3 1.5 1.5 2.5" />
        <path d="M9 18h6" />
        <path d="M10 22h4" />
      </svg>
      <p className="flex-1 text-[13px] leading-[18px] text-gray-500 dark:text-[#8FA4B8]">{text}</p>
      <button
        onClick={onClose}
        aria-label={t('common.close')}
        className="shrink-0 p-1 -m-1 text-gray-400 hover:text-gray-600 dark:text-[#5C7A8E] dark:hover:text-[#8FA4B8] transition-colors"
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" aria-hidden="true">
          <path d="M18 6 6 18" />
          <path d="m6 6 12 12" />
        </svg>
      </button>
    </div>
  );
}
