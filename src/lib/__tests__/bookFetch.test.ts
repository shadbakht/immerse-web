import {
  collectPassages,
  getCachedBook,
  putCachedBook,
  _resetBookCache,
  WAVE,
} from '../bookFetch';

/** Build a fetchPage stub over a fixed total row set, recording concurrency. */
function makeFetcher(total: number, batch = 1000) {
  const calls: Array<{ from: number; to: number }> = [];
  let inFlight = 0;
  let maxConcurrent = 0;
  const fetchPage = async (from: number, to: number) => {
    calls.push({ from, to });
    inFlight++;
    maxConcurrent = Math.max(maxConcurrent, inFlight);
    await new Promise(r => setTimeout(r, 5));
    inFlight--;
    const rows = [];
    for (let i = from; i <= to && i < total; i++) rows.push({ id: i });
    return { rows };
  };
  return { fetchPage, calls, get maxConcurrent() { return maxConcurrent; } };
}

describe('collectPassages', () => {
  it('returns a single short page without further calls', async () => {
    const f = makeFetcher(50);
    const rows = await collectPassages(f.fetchPage, 1000);
    expect(rows).toHaveLength(50);
    expect(f.calls).toEqual([{ from: 0, to: 999 }]);
  });

  it('returns an exactly-one-full-page book with one extra (empty) probe', async () => {
    const f = makeFetcher(1000);
    const rows = await collectPassages(f.fetchPage, 1000);
    expect(rows).toHaveLength(1000);
  });

  it('fetches later pages in parallel and preserves order', async () => {
    const f = makeFetcher(2461, 1000);
    const rows = await collectPassages(f.fetchPage, 1000);
    expect(rows.map((r: any) => r.id)).toEqual(Array.from({ length: 2461 }, (_, i) => i));
    // page 0 serial, then a wave containing pages 1..N in parallel
    expect(f.maxConcurrent).toBeGreaterThan(1);
    expect(f.calls[0]).toEqual({ from: 0, to: 999 });
  });

  it('handles a book larger than one wave (needs a second wave)', async () => {
    // page 0 + WAVE*2 more pages, so the book spans two full waves regardless
    // of WAVE's current value.
    const total = 1000 + WAVE * 2 * 1000;
    const f = makeFetcher(total, 1000);
    const rows = await collectPassages(f.fetchPage, 1000);
    expect(rows).toHaveLength(total);
    expect(rows.map((r: any) => r.id)).toEqual(Array.from({ length: total }, (_, i) => i));
  });

  it('does not over-fetch: stops at the wave containing the short page', async () => {
    const f = makeFetcher(2461, 1000);
    await collectPassages(f.fetchPage, 1000);
    // page 0, then one wave of WAVE pages starting at 1000 — every page in
    // that wave is requested up front (Promise.all fires them all before any
    // result is examined), and the short page 3000-3999 (461 rows, book ends
    // at row 2460) stops a second wave from ever starting.
    const expected = [0, ...Array.from({ length: WAVE }, (_, i) => 1000 + i * 1000)];
    expect(f.calls.map(c => c.from)).toEqual(expected);
  });

  describe('onPage', () => {
    it('fires once per page, in order, each carrying every row collected so far', async () => {
      // One row short of "page 0 + a full wave" so the wave's last page is
      // itself the short (end-of-book) page — a clean multiple would instead
      // trigger one extra empty probe wave (a real, pre-existing quirk of
      // collectPassages' no-COUNT-query design, exercised in its own test
      // below rather than conflated with this one).
      const total = 1000 + WAVE * 1000 - 1;
      const f = makeFetcher(total, 1000);
      const pages: Array<{ rows: number; allSoFar: number }> = [];
      await collectPassages(f.fetchPage, 1000, (rows, allSoFar) => {
        pages.push({ rows: rows.length, allSoFar: allSoFar.length });
      });
      // One call for the serial first page, one per page in the single wave
      // this book spans (WAVE+1 total pages) — none skipped, none doubled.
      expect(pages).toHaveLength(1 + WAVE);
      expect(pages.reduce((sum, p) => sum + p.rows, 0)).toBe(total);
      for (let i = 0; i < pages.length; i++) {
        expect(pages[i].allSoFar).toBe(Math.min((i + 1) * 1000, total));
      }
      // Every page but the very last is a full page.
      for (let i = 0; i < pages.length - 1; i++) expect(pages[i].rows).toBe(1000);
      expect(pages[pages.length - 1].rows).toBe(999);
    });

    it('an exact-multiple book fires one extra (empty) probe page too', async () => {
      // Documents the pre-existing quirk noted above, now via onPage instead
      // of inspecting fetchPage's own call log.
      const total = 1000 + WAVE * 1000;
      const f = makeFetcher(total, 1000);
      const pages: Array<{ rows: number; allSoFar: number }> = [];
      await collectPassages(f.fetchPage, 1000, (rows, allSoFar) => {
        pages.push({ rows: rows.length, allSoFar: allSoFar.length });
      });
      expect(pages).toHaveLength(1 + WAVE + 1);
      expect(pages[pages.length - 1]).toEqual({ rows: 0, allSoFar: total });
    });

    it('still returns the same result when onPage is omitted', async () => {
      const f = makeFetcher(2461, 1000);
      const withCallback = await collectPassages(f.fetchPage, 1000, () => {});
      const f2 = makeFetcher(2461, 1000);
      const withoutCallback = await collectPassages(f2.fetchPage, 1000);
      expect(withCallback).toEqual(withoutCallback);
    });

    it('reflects a short final page (book end) in both rows and allSoFar', async () => {
      const f = makeFetcher(50, 1000); // single short page, no wave at all
      const pages: Array<{ rows: number; allSoFar: number }> = [];
      await collectPassages(f.fetchPage, 1000, (rows, allSoFar) => {
        pages.push({ rows: rows.length, allSoFar: allSoFar.length });
      });
      expect(pages).toEqual([{ rows: 50, allSoFar: 50 }]);
    });
  });
});

describe('book fetch LRU cache', () => {
  beforeEach(() => _resetBookCache());

  it('returns a cached value on hit', () => {
    putCachedBook('a', { bookData: { title: 'A' }, passageData: [] });
    expect(getCachedBook('a')?.bookData).toEqual({ title: 'A' });
    expect(getCachedBook('missing')).toBeUndefined();
  });

  it('evicts the oldest entry past a cap of 2', () => {
    putCachedBook('a', { bookData: 1, passageData: [] });
    putCachedBook('b', { bookData: 2, passageData: [] });
    putCachedBook('c', { bookData: 3, passageData: [] });
    expect(getCachedBook('a')).toBeUndefined();
    expect(getCachedBook('b')).toBeDefined();
    expect(getCachedBook('c')).toBeDefined();
  });

  it('a get promotes recency so the promoted entry survives the next eviction', () => {
    putCachedBook('a', { bookData: 1, passageData: [] });
    putCachedBook('b', { bookData: 2, passageData: [] });
    getCachedBook('a'); // promote a
    putCachedBook('c', { bookData: 3, passageData: [] });
    expect(getCachedBook('a')).toBeDefined();
    expect(getCachedBook('b')).toBeUndefined();
  });
});
