import { proximityTokens, clusterCoverage, PROXIMITY_HL_STOP } from '../proximitySnippet';

describe('proximityTokens', () => {
  it('keeps words > 2 chars, lower-cased, strips FTS punctuation', () => {
    expect(proximityTokens('Seek the Lord while he may be found'))
      .toEqual(['seek', 'the', 'lord', 'while', 'may', 'found']);
  });
  it('caps at 10 tokens', () => {
    expect(proximityTokens('aaa bbb ccc ddd eee fff ggg hhh iii jjj kkk')).toHaveLength(10);
  });
});

describe('clusterCoverage', () => {
  const text =
    'ho every one that thirsteth come ye to the waters ' +
    'and afterwards seek ye the lord while he may be found in truth';

  it('anchors on the window covering the most tokens, not the first word', () => {
    const { index, coverage } = clusterCoverage(text, ['seek', 'lord', 'while', 'found']);
    expect(coverage).toBe(4);
    expect(text.slice(index).startsWith('seek')).toBe(true);
  });

  it('does not anchor on the earliest lone "the"', () => {
    const { index } = clusterCoverage(text, ['seek', 'the', 'lord', 'while', 'found']);
    // "the" appears at char 34 (…to the waters); the cluster is much later.
    expect(index).toBeGreaterThan(text.indexOf('afterwards'));
  });

  it('reports {index:-1, coverage:0} when no token occurs', () => {
    expect(clusterCoverage(text, ['zzz', 'qqq'])).toEqual({ index: -1, coverage: 0 });
  });
});

describe('PROXIMITY_HL_STOP', () => {
  it('drops the noise words but keeps content words', () => {
    const kept = proximityTokens('Seek the Lord while he may be found')
      .filter(w => !PROXIMITY_HL_STOP.has(w));
    expect(kept).toEqual(['seek', 'lord', 'while', 'may', 'found']);
  });
});
