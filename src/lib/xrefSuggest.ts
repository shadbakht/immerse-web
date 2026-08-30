//
// On-demand AI cross-reference suggestions (v2.0 Phase 6) — web.
//
// Two calls to the `suggest-xrefs` edge function with the client's OWN full-text
// index in between: stage 1 gives phrases, we run them through the search_passages
// RPC, stage 2 scores the real passages that came back. rankSuggestions() is the
// pure glue — exclusion, annotation boost, strong/loose split, cap.
// fetchXrefSuggestions() is the orchestrator.
//
// ⚠️ Immerse (mobile) has src/services/xrefSuggest.ts with an identical
// rankSuggestions and identical constants. Keep them in step — the retrieval half
// differs (Postgres search_passages here, SQLite FTS5 chunks there), the ranking
// must not.

import type { SupabaseClient } from '@supabase/supabase-js';
import { weightedRankFusion } from './aiSearch';
import { buildCitation } from './citationUtils';

export const STRONG_THRESHOLD = 0.5;
export const MAX_SUGGESTIONS  = 5;
export const MAX_CANDIDATES    = 15;
export const ANNOTATION_BOOST  = 0.15;

export interface XrefCandidate {
  id: string;            // `${bookId}:${pid}` (mobile) / passage uuid (web)
  bookId: string;
  pid: string;
  citation: string;
  text: string;
  matchPhrase: string;
  annotated: null | { kind: 'compilation' | 'note'; label: string };
}

export interface XrefSuggestion extends XrefCandidate {
  score: number;
  reason: string;
  loose: boolean;
}

export type XrefSuggestOutcome =
  | { status: 'ok'; suggestions: XrefSuggestion[] }
  | { status: 'unavailable' };

interface RankArgs {
  candidates: XrefCandidate[];
  rankings: Array<{ id: string; score: number; reason: string }>;
  sourceKey: string;
  excludeKeys: Set<string>;
}

export function rankSuggestions({ candidates, rankings, sourceKey, excludeKeys }: RankArgs): XrefSuggestion[] {
  const byId = new Map(rankings.map(r => [r.id, r]));
  const rows: Array<XrefSuggestion & { sortScore: number }> = [];
  for (const c of candidates) {
    if (c.id === sourceKey || excludeKeys.has(c.id)) continue;
    const r = byId.get(c.id);
    const score = r ? r.score : 0;
    const boost = c.annotated ? ANNOTATION_BOOST : 0;
    rows.push({ ...c, score, reason: r?.reason ?? '', loose: score < STRONG_THRESHOLD, sortScore: score + boost });
  }
  rows.sort((a, b) => b.sortScore - a.sortScore);
  return rows.slice(0, MAX_SUGGESTIONS).map(({ sortScore, ...s }) => s);
}

// ─── fetchXrefSuggestions — the web orchestrator ──────────────────────────────
//
// Two `suggest-xrefs` edge-function calls with the Postgres full-text index in
// between:
//   1. stage 'plan' → literal search phrases for the source paragraph.
//   2. run each phrase through the `search_passages` RPC (bag-of-words over the
//      GIN index), rank client-side by tightest span — the RPC has NO ORDER BY,
//      so this MUST happen here (mirrors runAiPhraseSearch in LibraryPanel).
//   3. fuse the per-phrase lists, resolve each passage row to a citation +
//      annotation state.
//   4. stage 'rank' → score those real candidates.
//   5. rankSuggestions() turns scores into the strong/loose split.
//
// Never throws. Any failure of stage 1 (offline, degraded) → `unavailable`, and
// the caller says nothing. A stage-2 failure is softer: stage 1 already worked
// and the reader is waiting, so the candidates are shown unranked (all loose)
// rather than dropped.

export interface FetchArgs {
  supabase: SupabaseClient;
  /** Source paragraph text — the caller footnote-strips; we strip again defensively. */
  sourceText: string;
  /** uuid of the selected passage — also the client key for exclusion/ranking. */
  sourcePassageId: string;
  sourceBookUuid: string;
  /** Content language of the source book. */
  language: string;
  /** Book uuids to search; null = whole same-language library. */
  bookScope: string[] | null;
  /** Passage uuids already cross-referenced to the source. */
  alreadyLinkedIds: Set<string>;
  userId: string;
}

const PLAN_TEXT_CAP = 400;
const PASSAGE_SELECT =
  'id, content, chapter_label, section_title, paragraph_number, book_id, books(id, title, citation_format, authors(name))';

// LibraryPanel keeps its own copy of this; replicated minimally here to stay a
// leaf module (no dependency on the component tree).
function foldPunctuation(s: string): string {
  return String(s)
    .replace(/[‘’‚‹›]/g, "'")
    .replace(/[“”„«»]/g, '"')
    .replace(/[–—]/g, '-');
}

function stripFootnoteMarkers(s: string): string {
  return s.replace(/\[\d+\]/g, '');
}

interface PassageRow {
  id: string;
  content: string | null;
  chapter_label: string | null;
  section_title: string | null;
  paragraph_number: number | null;
  book_id: string | null;
  books?: {
    id?: string | null;
    title?: string | null;
    citation_format?: string | null;
    authors?: { name?: string | null } | null;
  } | null;
  __matchPhrase: string;
}

export async function fetchXrefSuggestions(args: FetchArgs): Promise<XrefSuggestOutcome> {
  try {
    // 1. Plan — literal phrases for the source paragraph.
    const cleanSource = stripFootnoteMarkers(args.sourceText).slice(0, PLAN_TEXT_CAP);
    const { data: plan, error } = await args.supabase.functions.invoke('suggest-xrefs', {
      body: { stage: 'plan', text: cleanSource, language: args.language },
    });
    if (error || !plan || plan.degraded) return { status: 'unavailable' };

    // 2. Phrases first, distinctive single terms as a fallback tail.
    const phrases: string[] = [
      ...(Array.isArray(plan.phrases) ? plan.phrases : []),
      ...(Array.isArray(plan.terms) ? plan.terms : []),
    ].filter((p: unknown): p is string => typeof p === 'string' && p.trim().length > 0);
    if (phrases.length === 0) return { status: 'ok', suggestions: [] };

    // 3. Run each phrase through the search_passages RPC, then rank client-side.
    //    The RPC is `limit 40` over an UNRANKED scan, so ordering is entirely on
    //    us: drop rows missing any content word, order by the tightest span
    //    between the first and last of them (same idea as LibraryPanel's
    //    runAiPhraseSearch, but with a >=3-char content-word threshold per the
    //    Phase 6 spec, vs that function's >=4).
    const perPhraseLists: PassageRow[][] = await Promise.all(
      phrases.map(async (phrase): Promise<PassageRow[]> => {
        try {
          const contentWords = phrase
            .split(/\s+/)
            .map(w => foldPunctuation(w).toLowerCase())
            .filter(w => w.length >= 3);
          if (contentWords.length < 2) return [];

          const { data } = await args.supabase
            .rpc('search_passages', {
              search_query: contentWords.join(' '),
              // An empty array yields no rows — send null (whole library) instead.
              book_scope: args.bookScope && args.bookScope.length > 0 ? args.bookScope : null,
            })
            .select(PASSAGE_SELECT);

          const scored = ((data as any[]) ?? [])
            .map(row => {
              const text = foldPunctuation(String(row.content ?? '')).toLowerCase();
              const positions = contentWords.map(w => text.indexOf(w));
              if (positions.some(i => i < 0)) return null;
              return {
                row: { ...row, __matchPhrase: phrase } as PassageRow,
                span: Math.max(...positions) - Math.min(...positions),
              };
            })
            .filter(Boolean) as Array<{ row: PassageRow; span: number }>;

          scored.sort((a, b) => a.span - b.span);
          return scored.map(s => s.row);
        } catch {
          return [];
        }
      }),
    );
    if (perPhraseLists.every(l => l.length === 0)) return { status: 'ok', suggestions: [] };

    // 4. Fuse the per-phrase lists into one order, dedup by passage uuid.
    const fused = weightedRankFusion<PassageRow>(
      perPhraseLists.map(items => ({ items, weight: 1 })),
      row => row.id,
    ).slice(0, MAX_CANDIDATES);

    // 5. Build candidates. Web anchors on the passage row directly — ReaderPanel
    //    scrolls to `p-${passageId}` — so `id`, `pid` are both the passage uuid.
    const byId = new Map<string, XrefCandidate>();
    for (const row of fused) {
      const id = row.id;
      if (!id || id === args.sourcePassageId || args.alreadyLinkedIds.has(id) || byId.has(id)) continue;

      let citation: string;
      try {
        citation =
          buildCitation(
            {
              chapter_label: row.chapter_label,
              section_title: row.section_title,
              paragraph_number: row.paragraph_number,
            },
            { title: row.books?.title, citation_format: row.books?.citation_format },
            row.books?.authors?.name,
          ) || (row.books?.title ?? '');
      } catch {
        citation = row.books?.title ?? '';
      }

      byId.set(id, {
        id,
        bookId: row.book_id ?? '',
        pid: id,
        citation,
        text: stripFootnoteMarkers(String(row.content ?? '')).slice(0, PLAN_TEXT_CAP),
        matchPhrase: row.__matchPhrase,
        annotated: null,
      });
    }

    const candidates = [...byId.values()];
    if (candidates.length === 0) return { status: 'ok', suggestions: [] };

    // 6. Mark which candidates carry the reader's own compilation / note.
    //    Best-effort — any failure leaves every candidate unannotated.
    try {
      const candidateIds = candidates.map(c => c.id);
      const { data: sels } = await args.supabase
        .from('selections')
        .select('id, passage_id')
        .eq('user_id', args.userId)
        .in('passage_id', candidateIds);
      const selRows = (sels as Array<{ id: string; passage_id: string }>) ?? [];
      if (selRows.length > 0) {
        const passageBySelId = new Map(selRows.map(s => [s.id, s.passage_id]));
        const selIds = selRows.map(s => s.id);

        const annById = new Map<string, { kind: 'compilation' | 'note'; label: string }>();

        // Both queries depend only on selIds — run them together.
        const [{ data: stRows }, { data: noteRows }] = await Promise.all([
          args.supabase.from('selection_tags').select('selection_id, tags(name)').in('selection_id', selIds),
          args.supabase.from('notes').select('selection_id').in('selection_id', selIds),
        ]);

        // Compilation wins over note, so apply selection_tags first.
        for (const st of ((stRows as any[]) ?? [])) {
          const pid = passageBySelId.get(st.selection_id);
          if (!pid || annById.has(pid)) continue;
          const name = Array.isArray(st.tags) ? st.tags[0]?.name : st.tags?.name;
          annById.set(pid, { kind: 'compilation', label: name ?? '' });
        }

        for (const n of ((noteRows as any[]) ?? [])) {
          const pid = passageBySelId.get(n.selection_id);
          if (!pid || annById.has(pid)) continue; // compilation wins over note
          annById.set(pid, { kind: 'note', label: '' });
        }

        for (const c of candidates) c.annotated = annById.get(c.id) ?? null;
      }
    } catch {
      /* best-effort — leave candidates unannotated */
    }

    // 7. Rank — score the real candidates. A stage-2 failure is NOT `unavailable`:
    //    stage 1 succeeded and the reader is waiting, so show them all as loose.
    const { data: rk, error: rkErr } = await args.supabase.functions.invoke('suggest-xrefs', {
      body: {
        stage: 'rank',
        sourceText: cleanSource,
        language: args.language,
        candidates: candidates.slice(0, MAX_CANDIDATES).map(c => ({
          id: c.id,
          citation: c.citation,
          text: c.text.slice(0, PLAN_TEXT_CAP),
        })),
      },
    });
    const rankings = !rkErr && rk && Array.isArray(rk.rankings) ? rk.rankings : [];

    return {
      status: 'ok',
      suggestions: rankSuggestions({
        candidates,
        rankings,
        sourceKey: args.sourcePassageId,
        excludeKeys: args.alreadyLinkedIds,
      }),
    };
  } catch {
    return { status: 'unavailable' };
  }
}
