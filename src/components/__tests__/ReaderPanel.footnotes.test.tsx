// ReaderPanel pulls in the Supabase browser client at module load (via
// annotationSync), which throws without NEXT_PUBLIC_* env — not loaded in the
// jest 'test' environment. Stub it so we can import the pure helper.
jest.mock('@/lib/supabase/client', () => ({ createClient: () => ({}) }));

import { resolveFootnoteText } from '../ReaderPanel';

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
