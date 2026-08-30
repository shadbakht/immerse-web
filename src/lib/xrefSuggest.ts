//
// On-demand AI cross-reference suggestions (v2.0 Phase 6) — web.
//
// Two calls to the `suggest-xrefs` edge function with the client's OWN full-text
// index in between: stage 1 gives phrases, we run them through the search_passages
// RPC, stage 2 scores the real passages that came back. rankSuggestions() is the
// pure glue — exclusion, annotation boost, strong/loose split, cap.
// fetchXrefSuggestions() is the orchestrator (added in a later task).
//
// ⚠️ Immerse (mobile) has src/services/xrefSuggest.ts with an identical
// rankSuggestions and identical constants. Keep them in step — the retrieval half
// differs (Postgres search_passages here, SQLite FTS5 chunks there), the ranking
// must not.

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
