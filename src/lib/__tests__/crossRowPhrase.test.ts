import { stitchPhraseAcrossRows } from '../crossRowPhrase';

// Same fold the app uses: curly → straight, dashes → hyphen. Simplified here.
const fold = (s: string) =>
  s.replace(/[''‚‹›]/g, "'")
   .replace(/[""„«»]/g, '"')
   .replace(/[–—]/g, '-');

const row = (sort_order: number, content: string) => ({ sort_order, content, id: `p${sort_order}` });

describe('stitchPhraseAcrossRows', () => {
  it('finds a phrase split across two consecutive rows, returning the first row', () => {
    const rows = [
      row(10, 'Seek ye the Lord'),
      row(11, 'while he may be found, call upon him'),
    ];
    const out = stitchPhraseAcrossRows(rows, 'the lord while he may be found', fold);
    expect(out.map(r => r.sort_order)).toEqual([10]);
  });

  it('finds a phrase split across three consecutive rows', () => {
    const rows = [
      row(3, 'a b c seek'),
      row(4, 'the'),
      row(5, 'lord now'),
    ];
    const out = stitchPhraseAcrossRows(rows, 'seek the lord', fold);
    expect(out.map(r => r.sort_order)).toEqual([3]);
  });

  it('does NOT report a window where one single row already contains the whole phrase', () => {
    const rows = [
      row(1, 'seek the lord entirely here'),
      row(2, 'unrelated text'),
    ];
    const out = stitchPhraseAcrossRows(rows, 'seek the lord', fold);
    expect(out).toEqual([]);
  });

  it('does not stitch across a sort_order gap', () => {
    const rows = [
      row(10, 'seek'),
      row(12, 'the lord'), // 11 missing — not consecutive
    ];
    const out = stitchPhraseAcrossRows(rows, 'seek the lord', fold);
    expect(out).toEqual([]);
  });

  it('returns [] when the phrase is absent', () => {
    const rows = [row(1, 'nothing'), row(2, 'to see')];
    expect(stitchPhraseAcrossRows(rows, 'seek the lord', fold)).toEqual([]);
  });

  it('reports each distinct start once, not twice for the 2- and 3-row window', () => {
    const rows = [
      row(1, 'seek the'),
      row(2, 'lord and'),
      row(3, 'more'),
    ];
    const out = stitchPhraseAcrossRows(rows, 'seek the lord', fold);
    expect(out.map(r => r.sort_order)).toEqual([1]);
  });

  it('folds punctuation before matching (curly quotes in source)', () => {
    const rows = [row(1, 'the "holy'), row(2, 'mariner" sailed')];
    const out = stitchPhraseAcrossRows(rows, '"holy mariner"', fold);
    expect(out.map(r => r.sort_order)).toEqual([1]);
  });
});
