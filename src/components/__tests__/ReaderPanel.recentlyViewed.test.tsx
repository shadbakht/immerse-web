/** @jest-environment jsdom */
// ReaderPanel pulls in the Supabase browser client at module load (via
// annotationSync); stub it so we can import the pure helper.
jest.mock('@/lib/supabase/client', () => ({ createClient: () => ({}) }));

import { recentlyViewedProgressRow } from '../ReaderPanel';

type P = { id: string; sort_order: number };
const passages: P[] = [
  { id: 'a', sort_order: 0 },
  { id: 'b', sort_order: 50 },
  { id: 'c', sort_order: 100 },
];

describe('recentlyViewedProgressRow', () => {
  it('uses the preferred pid and its fraction when it is one of the passages', () => {
    expect(recentlyViewedProgressRow(passages, 'b')).toEqual({
      passage_id: 'b',
      passage_sort_order: 50,
      fraction: 0.5,
    });
  });

  it('falls back to the first passage (fraction ~0) when there is no preferred pid', () => {
    expect(recentlyViewedProgressRow(passages, null)).toEqual({
      passage_id: 'a',
      passage_sort_order: 0,
      fraction: 0,
    });
  });

  it('falls back to the first passage when the preferred pid is not in this book', () => {
    expect(recentlyViewedProgressRow(passages, 'gone')).toEqual({
      passage_id: 'a',
      passage_sort_order: 0,
      fraction: 0,
    });
  });

  it('returns null for an empty book (nothing to record)', () => {
    expect(recentlyViewedProgressRow([], 'a')).toBeNull();
  });

  it('never divides by zero when every passage is sort_order 0', () => {
    const row = recentlyViewedProgressRow([{ id: 'x', sort_order: 0 }], 'x');
    expect(row).toEqual({ passage_id: 'x', passage_sort_order: 0, fraction: 0 });
  });
});
