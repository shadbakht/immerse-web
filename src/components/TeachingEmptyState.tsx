'use client';

import type { ComponentType } from 'react';
import { useTranslation } from '@/contexts/LanguageProvider';

interface Props {
  /** The annotation's own glyph (TagIcon, NoteIcon, XRefIcon), as in the reader. */
  Icon: ComponentType<{ color?: string; size?: number }>;
  color: string;
  title: string;
  body: string;
  onOpenLibrary: () => void;
}

/**
 * What Compilations, Notes and X-Refs show before the first one exists: what
 * it is for, the icon to look for in the reader's selection bar, and a way to
 * go and make one. Mirrors mobile's TeachingEmptyState.
 */
export default function TeachingEmptyState({ Icon, color, title, body, onOpenLibrary }: Props) {
  const { t } = useTranslation();
  return (
    <div className="flex justify-center px-6 py-16">
      <div className="w-full max-w-md bg-white dark:bg-[#1B2A38] border border-gray-100 dark:border-[#2D4050] rounded-2xl shadow-sm px-6 py-7 flex flex-col items-center gap-3 text-center">
        <div
          className="w-16 h-16 rounded-full flex items-center justify-center mb-1"
          style={{ backgroundColor: `${color}24` }}
        >
          <Icon color={color} size={28} />
        </div>
        <h2 className="text-lg font-bold text-gray-900 dark:text-[#E2EAF2] text-balance">{title}</h2>
        <p className="text-sm text-gray-500 dark:text-[#8FA4B8] leading-relaxed">{body}</p>
        <div className="flex items-center gap-2 rounded-lg bg-gray-50 dark:bg-[#15212C] px-3 py-2">
          <Icon color={color} size={14} />
          <span className="text-xs text-gray-500 dark:text-[#8FA4B8]">{t('common.selectTextHint')}</span>
        </div>
        <button
          onClick={onOpenLibrary}
          className="mt-1 bg-[#1B6B7B] dark:bg-[#2D9DB3] text-white font-semibold text-sm px-6 py-3 rounded-xl hover:bg-[#155a68] dark:hover:bg-[#2589A0] transition-colors"
        >
          {t('common.openLibrary')}
        </button>
      </div>
    </div>
  );
}
