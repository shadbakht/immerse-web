// Pure ranking helpers only — planAiSearch pulls in the Supabase client, which
// isn't needed to test the fusion/ordering logic itself.
import { weightedRankFusion, fusionWeights, orderForDisplay, traditionsForSlugs } from '../aiSearch';

// Mirrors mobile's src/services/__tests__/aiSearch.test.ts — keep both in step.

describe('fusionWeights', () => {
  it('lets a question be answered by the AI phrases, not the keyword noise', () => {
    const w = fusionWeights(true);
    expect(w.ai).toBeGreaterThan(w.keyword);
  });

  it('keeps literal matches on top for a plain lookup', () => {
    const w = fusionWeights(false);
    expect(w.keyword).toBeGreaterThan(w.ai);
  });
});

describe('orderForDisplay', () => {
  const row = (passageId: string, semantic = false) => ({ passageId, semantic });

  it("leaves a question's fused order untouched", () => {
    const fused = [row('related-1', true), row('literal-1'), row('related-2', true)];
    expect(orderForDisplay(fused, true)).toEqual(fused);
  });

  it('moves every literal hit ahead of every AI-only hit for a lookup, even when consensus outscored them', () => {
    // Reproduces the "kill" bug (found on mobile, same fusion code here):
    // several of Claude's guessed phrases agreed with each other and
    // out-scored the single-word literal matches, so the fused list put
    // AI-"Related" rows first even though isQuestion is false.
    const fused = [row('agreed-related', true), row('literal-1'), row('another-related', true), row('literal-2')];
    expect(orderForDisplay(fused, false).map((r) => r.passageId)).toEqual([
      'literal-1', 'literal-2', 'agreed-related', 'another-related',
    ]);
  });

  it("preserves each side's own fused-score order — only partitions, never re-sorts", () => {
    const fused = [row('related-b', true), row('literal-b'), row('related-a', true), row('literal-a')];
    expect(orderForDisplay(fused, false).map((r) => r.passageId)).toEqual([
      'literal-b', 'literal-a', 'related-b', 'related-a',
    ]);
  });

  it('is a no-op when nothing is semantic', () => {
    const fused = [row('a'), row('b'), row('c')];
    expect(orderForDisplay(fused, false)).toEqual(fused);
  });
});

describe('weightedRankFusion', () => {
  const item = (id: string) => ({ id });
  const keyOf = (i: { id: string }) => i.id;

  it('lets a heavier list outrank a lighter one', () => {
    const fused = weightedRankFusion(
      [{ items: [item('keyword-noise')], weight: 1 }, { items: [item('ai-hit')], weight: 3 }],
      keyOf,
    );
    expect(fused.map(keyOf)).toEqual(['ai-hit', 'keyword-noise']);
  });

  it('rewards a passage that several lists agree on', () => {
    const fused = weightedRankFusion(
      [
        { items: [item('solo'), item('agreed')], weight: 3 },
        { items: [item('agreed')], weight: 3 },
      ],
      keyOf,
    );
    expect(fused[0].id).toBe('agreed');
  });
});

describe('traditionsForSlugs', () => {
  // The planner guesses WORDING; told nothing about the scope it recalls Bible
  // verses, which match nothing when the search is restricted to another shelf.
  const cats = [
    { id: 'cat-bahai', parentId: null, name: "Bahá'í" },
    { id: 'cat-bahai-abdulbah', parentId: 'cat-bahai', name: "'Abdu'l-Bahá" },
    { id: 'cat-hindu', parentId: null, name: 'Hindu' },
    { id: 'cat-hindu-up', parentId: 'cat-hindu', name: 'Upanishads' },
  ];
  const books = [
    { id: 'a', categoryId: 'cat-bahai-abdulbah' },
    { id: 'b', categoryId: 'cat-hindu-up' },
  ];
  it('names each selected book\'s root tradition once, sorted', () => {
    expect(traditionsForSlugs(new Set(['b', 'a']), books, cats)).toEqual(['Bahá\'í', 'Hindu']);
  });
  it('is empty for no selection or only imported books', () => {
    expect(traditionsForSlugs(new Set(), books, cats)).toEqual([]);
    expect(traditionsForSlugs(new Set(['imported:x']), books, cats)).toEqual([]);
  });
});
