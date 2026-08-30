import { rankSuggestions, STRONG_THRESHOLD, MAX_SUGGESTIONS } from '../xrefSuggest';
import type { XrefCandidate } from '../xrefSuggest';

const cand = (id: string, over: Partial<XrefCandidate> = {}): XrefCandidate => ({
  id, bookId: id.split(':')[0], pid: id.split(':')[1] ?? 'p1',
  citation: id, text: `text ${id}`, matchPhrase: 'x', annotated: null, ...over,
});

describe('rankSuggestions', () => {
  it('drops the source passage and already-linked passages', () => {
    const out = rankSuggestions({
      candidates: [cand('b1:p1'), cand('b1:p2'), cand('b1:p3')],
      rankings: [{ id: 'b1:p1', score: 0.9, reason: 'r' }, { id: 'b1:p2', score: 0.8, reason: 'r' }, { id: 'b1:p3', score: 0.7, reason: 'r' }],
      sourceKey: 'b1:p1',
      excludeKeys: new Set(['b1:p3']),
    });
    expect(out.map(s => s.id)).toEqual(['b1:p2']);
  });

  it('applies the annotation boost only to the sort, not the shown score', () => {
    const out = rankSuggestions({
      candidates: [cand('b:1'), cand('b:2', { annotated: { kind: 'compilation', label: 'Covenant' } })],
      rankings: [{ id: 'b:1', score: 0.60, reason: 'a' }, { id: 'b:2', score: 0.50, reason: 'b' }],
      sourceKey: 's:0', excludeKeys: new Set(),
    });
    expect(out.map(s => s.id)).toEqual(['b:2', 'b:1']);
    expect(out[0].score).toBe(0.50);
  });

  it('marks below-threshold rows loose but keeps them, capped at MAX_SUGGESTIONS', () => {
    const cs = Array.from({ length: 8 }, (_, i) => cand(`b:${i}`));
    const rs = cs.map((c, i) => ({ id: c.id, score: 0.9 - i * 0.1, reason: 'r' }));
    const out = rankSuggestions({ candidates: cs, rankings: rs, sourceKey: 's:0', excludeKeys: new Set() });
    expect(out).toHaveLength(MAX_SUGGESTIONS);
    expect(out[0].loose).toBe(false);
    expect(out[out.length - 1].loose).toBe(out[out.length - 1].score < STRONG_THRESHOLD);
  });

  it('defaults a missing ranking to score 0 / empty reason (still shown, loose)', () => {
    const out = rankSuggestions({
      candidates: [cand('b:1'), cand('b:2')],
      rankings: [{ id: 'b:1', score: 0.8, reason: 'r' }],
      sourceKey: 's:0', excludeKeys: new Set(),
    });
    expect(out.find(s => s.id === 'b:2')).toMatchObject({ score: 0, reason: '', loose: true });
  });
});
