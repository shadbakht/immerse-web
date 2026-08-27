'use client';

import { useState } from 'react';
import { useTranslation } from '@/contexts/LanguageProvider';

interface InlineCompilationCreatorProps {
  /** Name of the compilation this new one nests under, or null for top-level. */
  parentName: string | null;
  onSave: (name: string) => void;
  onCancel: () => void;
}

/**
 * The inline "+" editor for creating a compilation (or sub-compilation),
 * rendered directly under the row that was tapped rather than in the input
 * that used to be pinned above the tag list — see
 * docs/superpowers/specs/2026-08-26-reader-annotation-polish-design.md §2c
 * (mobile repo). Mirrors mobile's InlineCompilationCreator.tsx.
 */
export function InlineCompilationCreator({ parentName, onSave, onCancel }: InlineCompilationCreatorProps) {
  const { t } = useTranslation();
  const [name, setName] = useState('');

  const placeholder = parentName
    ? t('tagPanel.createWithin', { parent: parentName })
    : t('tagPanel.new');

  const handleSave = () => {
    const trimmed = name.trim();
    if (!trimmed) return;
    onSave(trimmed);
  };

  return (
    <div className="pb-3">
      <input
        autoFocus
        value={name}
        onChange={e => setName(e.target.value)}
        onKeyDown={e => e.key === 'Enter' && handleSave()}
        placeholder={placeholder}
        className="w-full border border-gray-200 dark:border-[#2D4050] rounded-xl px-3 py-2 text-sm text-gray-900 dark:text-[#E2EAF2] outline-none focus:ring-2 focus:ring-[#1B6B7B]/30 dark:focus:ring-[#2D9DB3]/30 focus:border-[#1B6B7B] dark:focus:border-[#2D9DB3] mb-2"
      />
      <div className="flex gap-2 justify-end">
        <button
          onClick={onCancel}
          className="px-3 py-1.5 text-sm text-gray-600 dark:text-[#8FA4B8] hover:bg-gray-100 dark:hover:bg-[#2D4050] rounded-lg"
        >
          {t('common.cancel')}
        </button>
        <button
          onClick={handleSave}
          disabled={!name.trim()}
          className="px-4 py-1.5 bg-[#1B6B7B] dark:bg-[#2D9DB3] text-white text-sm rounded-lg disabled:opacity-40 hover:bg-[#155a68] dark:hover:bg-[#2589A0] transition-colors"
        >
          {t('common.save')}
        </button>
      </div>
    </div>
  );
}
