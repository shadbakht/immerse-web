// ReaderPanel pulls in the Supabase browser client at module load (via
// annotationSync), which throws without NEXT_PUBLIC_* env — not loaded in the
// jest 'test' environment. Stub it so we can import the pure helper.
jest.mock('@/lib/supabase/client', () => ({ createClient: () => ({}) }));

import { dropCapEligible } from '../ReaderPanel';

describe('dropCapEligible', () => {
  const base = { showChapter: false, isPrayerStyle: false, isHeadingEcho: false, pendingAfterHeading: false, isLetterDate: false };
  it('true when a passage renders its own chapter-opening paragraph', () => {
    expect(dropCapEligible({ ...base, showChapter: true })).toBe(true);
  });
  it('true on the first paragraph after a heading-echo row', () => {
    expect(dropCapEligible({ ...base, pendingAfterHeading: true })).toBe(true);
  });
  it('false for a heading-echo row itself (it renders no <p>)', () => {
    expect(dropCapEligible({ ...base, showChapter: true, isHeadingEcho: true })).toBe(false);
  });
  it('false for prayer-style books', () => {
    expect(dropCapEligible({ ...base, showChapter: true, isPrayerStyle: true })).toBe(false);
  });
  it('false for a letter-date line even when a cap is pending after a heading', () => {
    expect(dropCapEligible({ ...base, pendingAfterHeading: true, isLetterDate: true })).toBe(false);
  });
  it('false for an ordinary mid-chapter paragraph', () => {
    expect(dropCapEligible(base)).toBe(false);
  });
});
