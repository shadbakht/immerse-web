'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { useTranslation } from '@/contexts/LanguageProvider';
import { buildCitation } from '@/lib/citationUtils';
import { citationInParens } from '@/lib/exportShared';
import { loadCatalog, loadSlugMaps } from '@/lib/catalog';
import { groupXrefsByPair } from '@/lib/xrefGrouping';
import { makeTraditionResolver } from '@/lib/tradition';
import { traditionPairOf, getSharedXrefSet, type XrefShareSide } from '@/lib/sharedSets';
import SaveOnLoad from './SaveOnLoad';

const NIL_UUID = '00000000-0000-0000-0000-000000000000';

interface PassageRow {
  id: string;
  book_id: string | null;
  chapter_label: string | null;
  section_title: string | null;
  paragraph_number: number | null;
}
interface BookRow {
  id: string;
  title: string | null;
  citation_format: string | null;
  // PostgREST returns the embedded author as an object for a to-one FK, but
  // types it as an array in some client versions — accept both.
  authors: { name: string | null } | { name: string | null }[] | null;
}
const authorName = (book: BookRow): string | null =>
  (Array.isArray(book.authors) ? book.authors[0]?.name : book.authors?.name) ?? null;

interface ResolvedSide {
  snapshot: string;
  citation: string;
  readerHref: string | null;
  bookUuid: string;
}
interface ResolvedEntry {
  xrefId: string;
  label: string | null;
  createdAt: string;
  pairKey: string;
  pairName: string;
  a: ResolvedSide;
  b: ResolvedSide;
}

/**
 * The public read-only view of one shared cross-reference set (kind='xrefs').
 *
 * Unlike the compilation view — which renders a snapshot stored on the
 * `shared_sets` row — this fetches live through `get_shared_xref_set`, so a
 * relabelled or re-anchored xref shows its current text on the next load
 * (spec §4.2). Citations and reader links are resolved from the public
 * `passages`/`books` tables the same way `fetchSelectionsByUser` does; the
 * layout mirrors `xrefExport.ts`'s PDF (teal pair heading, two columns split
 * by a hairline rule, muted italic citation under each quote).
 *
 * Analytics: `shared_xrefs_viewed` fires from SaveOnLoad, never from here —
 * one event per page load, whether or not this view reaches its ready state.
 */
export default function SharedXrefsView({ id, title }: { id: string; title: string }) {
  const { t } = useTranslation();
  const [state, setState] = useState<'loading' | 'ready' | 'empty' | 'error'>('loading');
  const [pairs, setPairs] = useState<{ pairKey: string; pairName: string; entries: ResolvedEntry[] }[]>([]);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      const set = await getSharedXrefSet(id);
      if (cancelled) return;
      if (!set) { setState('error'); return; }
      if (!set.content.length) { setState('empty'); return; }

      const supabase = createClient();
      const [catalog, { uuidToSlug, slugToUuid }] = await Promise.all([
        loadCatalog(),
        loadSlugMaps(supabase),
      ]);

      // Citation metadata for every side that still resolves to a live passage.
      const passageIds = [...new Set(
        set.content.flatMap(e => [e.a.passage_id, e.b.passage_id]).filter(Boolean) as string[],
      )];
      const { data: passData } = await supabase
        .from('passages')
        .select('id, book_id, chapter_label, section_title, paragraph_number')
        .in('id', passageIds.length ? passageIds : [NIL_UUID]);
      const passMap = new Map<string, PassageRow>(
        ((passData ?? []) as PassageRow[]).map(p => [p.id, p]),
      );

      const bookUuids = [...new Set([...passMap.values()].map(p => p.book_id).filter(Boolean) as string[])];
      const { data: bookData } = await supabase
        .from('books')
        .select('id, title, citation_format, authors(name)')
        .in('id', bookUuids.length ? bookUuids : [NIL_UUID]);
      const bookByUuid = new Map<string, BookRow>(
        ((bookData ?? []) as BookRow[]).map(b => [b.id, b]),
      );

      const traditionOf = makeTraditionResolver(catalog, uuidToSlug, t('common.otherTradition'));

      const resolveSide = (side: XrefShareSide): ResolvedSide => {
        const passage = side.passage_id ? passMap.get(side.passage_id) : null;
        const book = passage?.book_id ? bookByUuid.get(passage.book_id) : null;
        const citation = passage && book ? buildCitation(passage, book, authorName(book)) : '';
        // Prefer the passage's own book; fall back to the slug the RPC carries
        // for a side whose passage row is gone.
        const bookUuid: string =
          passage?.book_id
          ?? (side.book_local_id ? slugToUuid.get(side.book_local_id) : undefined)
          ?? '';
        return {
          snapshot: side.snapshot_text,
          citation,
          readerHref: bookUuid
            ? `/read/${bookUuid}${side.passage_id ? `?p=${side.passage_id}` : ''}`
            : null,
          bookUuid,
        };
      };

      const resolved: ResolvedEntry[] = set.content.map(e => {
        const a = resolveSide(e.a);
        const b = resolveSide(e.b);
        const pair = traditionPairOf(traditionOf(a.bookUuid), traditionOf(b.bookUuid));
        return {
          xrefId: e.xref_id,
          label: e.label,
          createdAt: e.created_at,
          pairKey: pair.pairKey,
          pairName: pair.pairName,
          a,
          b,
        };
      });

      const grouped = groupXrefsByPair(resolved, {
        getLabel: r => r.label,
        getCreatedAt: r => r.createdAt,
        getPairKey: r => r.pairKey,
        getPairName: r => r.pairName,
      });

      if (cancelled) return;
      setPairs(grouped.map(g => ({ pairKey: g.pairKey, pairName: g.pairName, entries: g.items })));
      setState('ready');
    })().catch(() => { if (!cancelled) setState('error'); });

    return () => { cancelled = true; };
  }, [id, t]);

  return (
    <div>
      <p className="text-[11px] font-semibold uppercase tracking-wider text-gray-400 dark:text-[#5C7A8E]">
        {t('sharePage.xrefEyebrow')}
      </p>
      <h1 className="mt-1 text-2xl font-bold text-gray-900 dark:text-white">{title}</h1>

      {state === 'loading' && (
        <p className="mt-6 text-sm text-gray-400 dark:text-[#5C7A8E]">{t('common.loading')}</p>
      )}
      {(state === 'error' || state === 'empty') && (
        <p className="mt-6 text-sm text-gray-400 dark:text-[#5C7A8E]">{t('sharePage.xrefsGone')}</p>
      )}

      {state === 'ready' && (
        <div className="mt-6 space-y-8">
          {pairs.map(pair => (
            <section key={pair.pairKey}>
              <h2 className="border-b border-gray-200 pb-1.5 text-lg font-normal text-[#1B6B7B] dark:border-[#2D4050] dark:text-[#2D9DB3]">
                {pair.pairName}
              </h2>
              <div className="mt-4 space-y-6">
                {pair.entries.map(entry => (
                  <div key={entry.xrefId}>
                    {entry.label && (
                      <p className="mb-2 text-sm font-bold text-[#1B6B7B] dark:text-[#2D9DB3]">
                        {entry.label}
                      </p>
                    )}
                    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 sm:divide-x sm:divide-gray-300 dark:sm:divide-[#2D4050]">
                      {[entry.a, entry.b].map((side, i) => (
                        <div key={i} className={i === 1 ? 'sm:pl-4' : 'sm:pr-4'}>
                          <p className="font-serif leading-relaxed text-gray-700 dark:text-[#B8C7D6]">
                            {`“${side.snapshot}”`}
                          </p>
                          {side.citation && (
                            <p className="mt-1.5 text-xs italic text-gray-500 dark:text-[#5C7A8E]">
                              {citationInParens(side.citation)}
                            </p>
                          )}
                          {side.readerHref && (
                            <a
                              href={side.readerHref}
                              className="mt-1 inline-block text-xs text-[#1B6B7B] hover:underline dark:text-[#2D9DB3]"
                            >
                              {t('sharePage.openInReader')}
                            </a>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </section>
          ))}
        </div>
      )}

      <SaveOnLoad id={id} kind="xrefs" />

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
