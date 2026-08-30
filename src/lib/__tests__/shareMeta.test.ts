import { buildShareMetaDescription } from '../shareMeta';

const payload = (firstQuote: string) => ([
  { exportId: 't0', parentExportId: null, name: 'Root', depth: 0, sortOrder: 0,
    selections: firstQuote ? [{ snapshotText: firstQuote, startPid: 'p', endPid: 'p',
      startOffset: 0, endOffset: 0, bookId: 'b', createdAt: '' }] : [] },
]);

describe('buildShareMetaDescription', () => {
  it('uses the first quote, trimmed to ~160 chars with an ellipsis', () => {
    const long = 'A'.repeat(400);
    const out = buildShareMetaDescription(payload(long) as any, 1);
    expect(out.length).toBeLessThanOrEqual(161);
    expect(out.endsWith('…')).toBe(true);
  });
  it('returns a short first quote unchanged', () => {
    expect(buildShareMetaDescription(payload('Be generous in prosperity.') as any, 1))
      .toBe('Be generous in prosperity.');
  });
  it('falls back to a passage count when there are no quotes', () => {
    expect(buildShareMetaDescription(payload('') as any, 12))
      .toBe('12 passages across the world’s scriptures.');
  });
  it('handles the singular', () => {
    expect(buildShareMetaDescription(payload('') as any, 1))
      .toBe('1 passage across the world’s scriptures.');
  });
});
