// ReaderPanel pulls in the Supabase browser client at module load (via
// annotationSync), which throws without NEXT_PUBLIC_* env — not loaded in the
// jest 'test' environment. Stub it so we can import the pure helper.
jest.mock('@/lib/supabase/client', () => ({ createClient: () => ({}) }));

import { dropCapEligible, isCreditPassage } from '../ReaderPanel';

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
  it('false for a translator credit line even when a cap is pending after a heading', () => {
    expect(dropCapEligible({ ...base, pendingAfterHeading: true, isCredit: true })).toBe(false);
  });
});

describe('isCreditPassage', () => {
  it('matches an unnumbered "translated from the Pali by" colophon', () => {
    expect(isCreditPassage({ content: 'translated from the Pali by\nThanissaro Bhikkhu\n© 1999', paragraph_number: 0 })).toBe(true);
    expect(isCreditPassage({ content: 'Translated into English by Kosho Yamamoto\n[1973]', paragraph_number: 0 })).toBe(true);
  });
  it('leaves numbered paragraphs and ordinary prose alone', () => {
    expect(isCreditPassage({ content: 'translated from the Pali by\nThanissaro Bhikkhu', paragraph_number: 1 })).toBe(false);
    expect(isCreditPassage({ content: 'I have heard that on one occasion…', paragraph_number: 0 })).toBe(false);
  });
});
