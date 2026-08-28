import {
  collectPassages,
  getCachedBook,
  putCachedBook,
  _resetBookCache,
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
    const f = makeFetcher(6500, 1000); // page 0 + 6 more pages → 2 waves of 4
    const rows = await collectPassages(f.fetchPage, 1000);
    expect(rows).toHaveLength(6500);
    expect(rows.map((r: any) => r.id)).toEqual(Array.from({ length: 6500 }, (_, i) => i));
  });

  it('does not over-fetch: stops at the wave containing the short page', async () => {
    const f = makeFetcher(2461, 1000);
    await collectPassages(f.fetchPage, 1000);
    // page 0, then wave [1000,2000,3000,4000]; 3000-page is short → no wave 2
    expect(f.calls.map(c => c.from)).toEqual([0, 1000, 2000, 3000, 4000]);
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
