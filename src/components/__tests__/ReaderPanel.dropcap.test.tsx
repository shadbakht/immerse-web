// ReaderPanel pulls in the Supabase browser client at module load (via
// annotationSync), which throws without NEXT_PUBLIC_* env — not loaded in the
// jest 'test' environment. Stub it so we can import the pure helper.
jest.mock('@/lib/supabase/client', () => ({ createClient: () => ({}) }));

import { dropCapEligible } from '../ReaderPanel';

describe('dropCapEligible', () => {
  it('is true when a chapter opens and the book is not prayer-style', () => {
    expect(dropCapEligible({ showChapter: true, isPrayerStyle: false })).toBe(true);
  });
  it('is false for a prayer-style book even when a chapter opens', () => {
    expect(dropCapEligible({ showChapter: true, isPrayerStyle: true })).toBe(false);
  });
  it('is false when no chapter opens (section change, excerpt divider, ordinary paragraph)', () => {
    expect(dropCapEligible({ showChapter: false, isPrayerStyle: false })).toBe(false);
  });
});
