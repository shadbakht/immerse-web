import { groupXrefsByPair } from '../xrefGrouping';

type Row = { label: string | null; createdAt: string; pairKey: string; pairName: string };
const acc = {
  getLabel:    (r: Row) => r.label,
  getCreatedAt:(r: Row) => r.createdAt,
  getPairKey:  (r: Row) => r.pairKey,
  getPairName: (r: Row) => r.pairName,
};
function row(p: Partial<Row>): Row {
  return { label: null, createdAt: '2020-01-01T00:00:00Z', pairKey: 'k', pairName: 'K', ...p };
}

describe('groupXrefsByPair', () => {
  it('orders pairs by count desc, then pair name asc', () => {
    const groups = groupXrefsByPair([
      row({ pairKey: 'a', pairName: 'Zebra' }),
      row({ pairKey: 'b', pairName: 'Alpha' }),
      row({ pairKey: 'b', pairName: 'Alpha' }),
      row({ pairKey: 'c', pairName: 'Beta' }),
    ], acc);
    expect(groups.map(g => g.pairName)).toEqual(['Alpha', 'Beta', 'Zebra']);
  });

  it('within a pair: labelled A→Z first, then unlabelled newest-first', () => {
    const [group] = groupXrefsByPair([
      row({ pairKey: 'a', pairName: 'P', label: null, createdAt: '2021-01-01T00:00:00Z' }),
      row({ pairKey: 'a', pairName: 'P', label: 'Beta' }),
      row({ pairKey: 'a', pairName: 'P', label: 'Alpha' }),
      row({ pairKey: 'a', pairName: 'P', label: null, createdAt: '2023-01-01T00:00:00Z' }),
    ], acc);
    expect(group.items.map(r => r.label ?? `∅${r.createdAt.slice(0, 4)}`))
      .toEqual(['Alpha', 'Beta', '∅2023', '∅2021']);
  });
});
