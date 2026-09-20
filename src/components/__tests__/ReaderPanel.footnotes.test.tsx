// ReaderPanel pulls in the Supabase browser client at module load (via
// annotationSync), which throws without NEXT_PUBLIC_* env — not loaded in the
// jest 'test' environment. Stub it so we can import the pure helper.
jest.mock('@/lib/supabase/client', () => ({ createClient: () => ({}) }));

import { resolveFootnoteText, splitFootnoteMarkers } from '../ReaderPanel';

describe('resolveFootnoteText', () => {
  it('prefers the passage\'s own scoped footnote map when present', () => {
    const passage = { footnotes: { '1': 'Correct, chunk-scoped text' } };
    const bookMap = { '1': 'Wrong, collided book-wide text' };
    expect(resolveFootnoteText(passage, '1', bookMap)).toBe('Correct, chunk-scoped text');
  });

  it('falls back to the book-wide map when the passage has no footnotes column', () => {
    const passage = { footnotes: null };
    const bookMap = { '1': 'Book-wide text' };
    expect(resolveFootnoteText(passage, '1', bookMap)).toBe('Book-wide text');
  });

  it('falls back to the book-wide map when the passage has a footnotes map but not this number', () => {
    const passage = { footnotes: { '2': 'Some other footnote' } };
    const bookMap = { '1': 'Book-wide text' };
    expect(resolveFootnoteText(passage, '1', bookMap)).toBe('Book-wide text');
  });

  it('returns empty string when neither source has the number', () => {
    const passage = { footnotes: null };
    expect(resolveFootnoteText(passage, '1', {})).toBe('');
  });
});

describe('splitFootnoteMarkers', () => {
  const none = () => false;

  it('keeps treating every ASCII [N] as a marker, exactly as before', () => {
    expect(splitFootnoteMarkers('a[1]b[22]c', none)).toEqual([
      { text: 'a' }, { marker: '1' }, { text: 'b' }, { marker: '22' }, { text: 'c' },
    ]);
  });

  it('makes a Persian-digit [۲] a marker when the passage has that footnote', () => {
    expect(splitFootnoteMarkers('المتعال.[۲]', n => n === '۲')).toEqual([
      { text: 'المتعال.' }, { marker: '۲' },
    ]);
  });

  it('leaves a Persian-digit [۱] alone when there is no footnote for it (a compilation reference number)', () => {
    expect(splitFootnoteMarkers('(شمارۀ ۱۸۳) [۱]', none)).toEqual([{ text: '(شمارۀ ۱۸۳) [۱]' }]);
  });

  it('handles Arabic-Indic digits the same way', () => {
    expect(splitFootnoteMarkers('x[٣]', n => n === '٣')).toEqual([{ text: 'x' }, { marker: '٣' }]);
    expect(splitFootnoteMarkers('x[٣]', none)).toEqual([{ text: 'x[٣]' }]);
  });

  it('only marks the numbers that have a footnote when several appear together', () => {
    expect(splitFootnoteMarkers('a[۱]b[۲]', n => n === '۲')).toEqual([
      { text: 'a[۱]b' }, { marker: '۲' },
    ]);
  });
});
