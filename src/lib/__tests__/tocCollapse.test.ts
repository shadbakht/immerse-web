import { seedCollapsedToc, TOC_EXPAND_ROW_BUDGET } from '../tocCollapse';

const flat = (n: number) =>
  Array.from({ length: n }, (_, i) => ({ label: `${i}`, passageId: `p${i}`, depth: 0 }));

const nested = (sections: number, childrenPer: number) => {
  const out: { label: string; passageId: string; depth: number }[] = [];
  for (let s = 0; s < sections; s++) {
    out.push({ label: `S${s}`, passageId: `s${s}`, depth: 0 });
    for (let c = 0; c < childrenPer; c++) out.push({ label: `S${s}.${c}`, passageId: `s${s}c${c}`, depth: 1 });
  }
  return out;
};

describe('seedCollapsedToc', () => {
  it('returns empty for a flat TOC even when huge', () => {
    expect(seedCollapsedToc(flat(300)).size).toBe(0);
  });

  it('returns empty when a nested TOC fits the budget', () => {
    expect(seedCollapsedToc(nested(2, 3)).size).toBe(0); // 2 + 6 = 8 rows
  });

  it('collapses every parent when a nested TOC exceeds the budget', () => {
    const toc = nested(6, 8); // 6 + 48 = 54 rows
    expect(seedCollapsedToc(toc)).toEqual(new Set(['s0', 's1', 's2', 's3', 's4', 's5']));
  });

  it('is inclusive at the boundary', () => {
    const atBudget = nested(2, (TOC_EXPAND_ROW_BUDGET - 2) / 2); // total === budget
    expect(seedCollapsedToc(atBudget).size).toBe(0);
  });
});
