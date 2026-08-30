'use client';

import { useTranslation } from '@/contexts/LanguageProvider';
import { CompilationTree } from '@/components/CompilationTree';
import SaveOnLoad from './SaveOnLoad';

/**
 * Presentational shell for a shared compilation. The compilation name is the
 * only dynamic heading; everything else is chrome routed through t(). The
 * CompilationTree's built-in default open-book handler makes "Open in reader"
 * links work without wiring onOpenBook here.
 */
export default function SharedCompilationView({
  id,
  name,
  payload,
}: {
  id: string;
  name: string;
  payload: any[];
}) {
  const { t } = useTranslation();

  return (
    <div>
      <p className="text-[11px] font-semibold uppercase tracking-wider text-gray-400 dark:text-[#5C7A8E]">
        {t('sharePage.eyebrow')}
      </p>
      <h1 className="mt-1 text-2xl font-bold text-gray-900 dark:text-white">{name}</h1>

      <div className="mt-6 rounded-xl border border-gray-100 bg-white dark:border-[#2D4050] dark:bg-[#1B2A38]">
        <CompilationTree payload={payload} readOnly />
      </div>

      <SaveOnLoad id={id} />

      <div className="mt-10 border-t border-gray-100 pt-4 dark:border-[#2D4050]">
        <a
          href="https://immerseresearch.app"
          className="text-sm text-[#1B6B7B] hover:underline dark:text-[#2D9DB3]"
        >
          {t('sharePage.footer')}
        </a>
      </div>
    </div>
  );
}
