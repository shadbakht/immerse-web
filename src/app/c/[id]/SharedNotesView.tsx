'use client';

import { useTranslation } from '@/contexts/LanguageProvider';
import { citationInParens } from '@/lib/exportShared';
import { scriptScaleForText } from '@/lib/readerTypography';
import { splitShareByBook, type NoteShareEntry } from '@/lib/noteShare';

/**
 * A shared set of notes: each quote with its citation and the sharer's note
 * underneath, grouped by book. Read-only — a note share is a snapshot taken
 * when the link was made (and refreshed whenever its owner reopens it), so
 * there is nothing here to save into one's own library.
 */
export default function SharedNotesView({
  title,
  entries,
}: {
  title: string;
  entries: NoteShareEntry[];
}) {
  const { t } = useTranslation();
  const groups = splitShareByBook(entries);

  return (
    <div>
      <p className="text-[11px] font-semibold uppercase tracking-wider text-gray-400 dark:text-[#5C7A8E]">
        {t('sharePage.notesEyebrow')}
      </p>
      <h1
        className="mt-1 text-2xl font-bold text-gray-900 dark:text-white"
        style={{ fontSize: `calc(1.5rem * ${scriptScaleForText(title)})` }}
      >{title}</h1>

      <div className="mt-6 space-y-8">
        {groups.map((group, gi) => (
          <section key={`${group.bookTitle}|${gi}`}>
            <h2 className="border-b border-gray-200 pb-1.5 text-lg font-normal text-[#1B6B7B] dark:border-[#2D4050] dark:text-[#2D9DB3]">
              {group.bookTitle}
            </h2>
            <div className="mt-4 space-y-7">
              {group.entries.map(entry => (
                <div key={entry.note_id}>
                  <p
                    className="font-serif leading-relaxed text-gray-700 dark:text-[#B8C7D6]"
                    style={{ fontSize: `calc(1rem * ${scriptScaleForText(entry.quote)})` }}
                  >
                    {`“${entry.quote}”`}
                  </p>
                  {entry.citation && (
                    <p className="mt-1.5 text-xs italic text-gray-500 dark:text-[#5C7A8E]">
                      {citationInParens(entry.citation)}
                    </p>
                  )}
                  <p className="mt-3 whitespace-pre-wrap border-s-[3px] border-[#D4BC6A] ps-3 text-sm leading-relaxed text-gray-800 dark:text-[#D2DCE8]">
                    {entry.note}
                  </p>
                </div>
              ))}
            </div>
          </section>
        ))}
      </div>

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
