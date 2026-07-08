// Semantic search (web) — meaning-based passage retrieval.
//
// Calls the `semantic-search` edge function (OpenAI embeddings + pgvector), the
// same backend the mobile app uses. Anon-callable, so it works for signed-out
// visitors. Any failure resolves to [] so keyword search stands on its own.

import type { SupabaseClient } from '@supabase/supabase-js';

/** Flip off to disable the semantic path without a redeploy.
 *  Currently OFF: the `semantic-search` edge function + embeddings aren't live
 *  yet (pending Supabase Pro). Flip to true once the backend is deployed. */
export const SEMANTIC_SEARCH_ENABLED = false;

export interface SemanticResult {
  passageId: string;   // Supabase passage UUID
  bookId: string;      // Supabase book UUID
  bookTitle: string;
  snippet: string;
  similarity: number;
}

export async function semanticSearch(
  supabase: SupabaseClient,
  query: string,
  scope?: string[],
  limit = 40,
): Promise<SemanticResult[]> {
  const q = query.trim();
  if (!SEMANTIC_SEARCH_ENABLED || q.length < 2) return [];
  try {
    const { data, error } = await supabase.functions.invoke('semantic-search', {
      body: { query: q, scope: scope && scope.length ? scope : undefined, limit },
    });
    if (error || !data || data.degraded || !Array.isArray(data.results)) return [];
    return data.results
      .filter((r: any) => r?.passageId && r?.bookId)
      .map((r: any) => ({
        passageId: r.passageId,
        bookId: r.bookId,
        bookTitle: r.bookTitle ?? '',
        snippet: r.snippet ?? '',
        similarity: typeof r.similarity === 'number' ? r.similarity : 0,
      }));
  } catch {
    return [];
  }
}

/**
 * Reciprocal Rank Fusion — blend independently-ranked lists into one order
 * without calibrating their score scales. Standard k=60. Dedup by `keyOf`.
 */
export function reciprocalRankFusion<T>(lists: T[][], keyOf: (item: T) => string, k = 60): T[] {
  const score = new Map<string, number>();
  const first = new Map<string, T>();
  for (const list of lists) {
    list.forEach((item, i) => {
      const key = keyOf(item);
      score.set(key, (score.get(key) ?? 0) + 1 / (k + i + 1));
      if (!first.has(key)) first.set(key, item);
    });
  }
  return [...first.entries()]
    .sort((a, b) => (score.get(b[0]) ?? 0) - (score.get(a[0]) ?? 0))
    .map(([, item]) => item);
}
