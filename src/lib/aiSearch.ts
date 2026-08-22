// AI search — every library search goes through it.
//
// The reader never turns anything on. They type into the same field they always
// have, and Claude Haiku (the `ai-search` edge function) guesses the wording the
// relevant passages actually use; the caller runs those phrases back through the
// SAME Postgres search. Claude never sees the corpus and never names a passage,
// so it cannot invent a result: a phrase it made up matches nothing and vanishes.
//
// The ONLY gate is connectivity. With no connection the call fails,
// `unavailable` comes back, and search is the plain keyword search it has always
// been. Nothing else gates this — not question-shaped queries, not length. (A
// quoted "exact phrase" is held back by the CALLER, not here: quoting is the
// reader explicitly asking for a literal match.)
//
// ⚠️ This is the web half of a deliberately duplicated pair — mobile has
// `src/services/aiSearch.ts` with the same fusion and the same weights, and the
// two MUST stay in step or the same query ranks differently per platform. Same
// arrangement as semanticSearch.ts. If you change a rule here, change it there.
//
// The retrieval half is NOT shared, because the indexes differ: mobile runs
// SQLite FTS5 over chunk rows, web runs Postgres FTS over passage rows. See
// LibraryPanel's runAiPhraseSearch for why that difference actually helps here.

import type { SupabaseClient } from '@supabase/supabase-js';

/**
 * AI search: ask Claude Haiku for the wording the relevant passages likely use,
 * run those phrases through the same Postgres search, and blend the hits in. No
 * toggle and no separate UI.
 *
 * Turning this off returns search to keyword-only. Keyword search is unaffected
 * either way: it always runs first.
 */
export const AI_SEARCH_ENABLED = true;

export interface AiSearchPlan {
  /**
   * Claude's own reading of what the reader wanted. Drives RANKING, not whether
   * the search happens: a question's answers should outrank the keyword hits
   * (which mostly matched incidental words), while for a lookup the literal
   * matches are the point and the AI phrases merely supplement.
   */
  isQuestion: boolean;
  /** Multi-word fragments to look up, best first. */
  phrases: string[];
  /** Single distinctive words, used as a fallback when no phrase hits. */
  terms: string[];
}

export type AiSearchOutcome =
  | { status: 'ok'; plan: AiSearchPlan }
  /** Offline, rate-limited, over budget, or malformed — say nothing. */
  | { status: 'unavailable' };

// One plan per query per session. The edge function has a shared, durable cache
// of its own; this one just avoids the round trip when a reader retypes or comes
// back to a search they already ran.
const memo = new Map<string, AiSearchPlan>();
const MEMO_MAX = 50;

// ─── Planning ─────────────────────────────────────────────────────────────────

/**
 * Asks the `ai-search` edge function for phrases to look up.
 *
 * Never throws. Every failure — network, rate limit, budget, an unparseable
 * reply — resolves to `unavailable`, which the UI says nothing about, because
 * the keyword results are already on screen and still correct.
 */
export async function planAiSearch(
  supabase: SupabaseClient,
  query: string,
  language: string,
): Promise<AiSearchOutcome> {
  const q = (query ?? '').trim();
  if (q.length < 3) return { status: 'unavailable' };

  const key = `${language}|${q.toLowerCase()}`;
  const hit = memo.get(key);
  if (hit) return { status: 'ok', plan: hit };

  try {
    const { data, error } = await supabase.functions.invoke('ai-search', {
      body: { query: q, language: language || 'en' },
    });

    if (error || !data || data.degraded) return { status: 'unavailable' };

    const plan: AiSearchPlan = {
      isQuestion: data.isQuestion === true,
      phrases: Array.isArray(data.phrases) ? data.phrases.filter((p: unknown) => typeof p === 'string') : [],
      terms: Array.isArray(data.terms) ? data.terms.filter((t: unknown) => typeof t === 'string') : [],
    };
    if (memo.size >= MEMO_MAX) memo.clear(); // crude, bounded, good enough
    memo.set(key, plan);
    return { status: 'ok', plan };
  } catch {
    return { status: 'unavailable' };
  }
}

// ─── Ranking ──────────────────────────────────────────────────────────────────

/**
 * Weighted Reciprocal Rank Fusion — blends independently-ranked lists into one
 * order without having to calibrate their (incomparable) score scales. Each item
 * contributes `weight / (k + rank)` from every list it appears in; standard k=60.
 *
 * The weights are the whole point here. For a question the keyword list is
 * mostly noise (it matched "God" and "oppression" across the whole library) and
 * the AI phrases carry the answer; for a lookup it is the other way round — the
 * reader typed a word and expects the passages containing it first. An item both
 * lists agree on rises above either. Dedup is by the caller-provided key.
 */
export function weightedRankFusion<T>(
  lists: Array<{ items: T[]; weight: number }>,
  keyOf: (item: T) => string,
  k = 60,
): T[] {
  const score = new Map<string, number>();
  const first = new Map<string, T>();
  for (const { items, weight } of lists) {
    items.forEach((item, i) => {
      const key = keyOf(item);
      score.set(key, (score.get(key) ?? 0) + weight / (k + i + 1));
      if (!first.has(key)) first.set(key, item);
    });
  }
  return [...first.entries()]
    .sort((a, b) => (score.get(b[0]) ?? 0) - (score.get(a[0]) ?? 0))
    .map(([, item]) => item);
}

/**
 * How much to trust each list, given what Claude decided the query was.
 * Kept here rather than inline so both platforms weight identically.
 */
export function fusionWeights(isQuestion: boolean): { keyword: number; ai: number } {
  return isQuestion ? { keyword: 1, ai: 3 } : { keyword: 3, ai: 1 };
}
