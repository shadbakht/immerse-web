/**
 * Book-open data acquisition for the reader (Phase 4d perf).
 *
 * Two concerns, both isolated here so they can be unit-tested without a live
 * Supabase client:
 *
 *  1. `collectPassages` — page the `passages` table without paying one serial
 *     round trip per 1000 rows. Profiling (4d) measured a 2,461-passage book
 *     spending ~765 ms on three *serial* fetches for data that returns in one
 *     ~250 ms trip. After the first page we fetch the rest in parallel "waves"
 *     of `WAVE` pages, stopping at the wave that contains a short page. No
 *     server-side row count is requested — an exact count over `passages`
 *     (~900k rows) filtered by `book_id` was measured at ~500 ms, wiping out
 *     the parallelisation gain, and an estimated count risks truncation.
 *
 *  2. A tiny LRU cache of the last two books' fetched `{ bookData, passageData }`.
 *     Opening Settings / Notes / Tags / X-Refs unmounts the reader
 *     (`AppShell` `isFullWidth`), so returning to a book re-fetched all of it —
 *     ~1.7 s for a large book. Corpus content is static per deploy (an app
 *     reload ships a new bundle), and annotations are always loaded separately,
 *     so caching the raw fetch result is safe.
 */

export type PageResult = { rows: unknown[] };

export type FetchPage = (from: number, to: number) => Promise<PageResult>;

/** Pages fetched in parallel per wave after the first (serial) page. */
const WAVE = 4;

/**
 * Collect every row of a book's passages.
 *
 * @param fetchPage  Fetches rows `[from, to]` inclusive, ordered by `sort_order`.
 * @param batch      Page size (PostgREST caps server-side at 1000).
 */
export async function collectPassages(fetchPage: FetchPage, batch = 1000): Promise<unknown[]> {
  const first = (await fetchPage(0, batch - 1)).rows ?? [];
  if (first.length < batch) return first;

  const all = first.slice();
  let nextFrom = batch;
  let atEnd = false;
  while (!atEnd) {
    const wave = [];
    for (let i = 0; i < WAVE; i++) {
      const from = nextFrom + i * batch;
      wave.push(fetchPage(from, from + batch - 1));
    }
    const results = await Promise.all(wave);
    for (const res of results) {
      const rows = res.rows ?? [];
      all.push(...rows);
      if (rows.length < batch) {
        // Rows are contiguous and ordered, so once a page is short every
        // later range in this wave (and beyond) is empty.
        atEnd = true;
        break;
      }
    }
    nextFrom += WAVE * batch;
  }
  return all;
}

// ── LRU cache (last 2 cloud books) ───────────────────────────────────────────

export interface CachedBook {
  bookData: unknown;
  passageData: unknown[];
}

const CACHE_MAX = 2;
const cache = new Map<string, CachedBook>();

/** Get a cached book fetch, promoting it to most-recently-used. */
export function getCachedBook(bookId: string): CachedBook | undefined {
  const v = cache.get(bookId);
  if (v) {
    cache.delete(bookId);
    cache.set(bookId, v);
  }
  return v;
}

/** Store a book fetch, evicting the least-recently-used entry past the cap. */
export function putCachedBook(bookId: string, value: CachedBook): void {
  cache.delete(bookId);
  cache.set(bookId, value);
  while (cache.size > CACHE_MAX) {
    const oldest = cache.keys().next().value as string | undefined;
    if (oldest === undefined) break;
    cache.delete(oldest);
  }
}

/** Test helper. */
export function _resetBookCache(): void {
  cache.clear();
}
