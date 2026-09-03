/**
 * buildCommunityPayload — the discover/link split for imported-book quotes.
 *
 * Mirrors mobile's buildCompilationSnapshot(target):
 *   - 'discover' drops imported quotes; throws ImportedOnlyError when that empties
 *     a compilation that HAD selections.
 *   - 'link' keeps them, flagged importedReadOnly, with an empty citation.
 *
 * The Supabase client is mocked table-by-table (same style as tagExport.test.ts);
 * importedBooksResolve is mocked to supply the imported-book title map.
 */

let mockData: Record<string, Array<Record<string, unknown>>> = {};
let mockImportedTitles: Record<string, string> = {};

jest.mock('../supabase/client', () => ({
  createClient: () => ({
    from: (table: string) => ({
      select: () => ({
        in: async () => ({ data: mockData[table] ?? [] }),
        or: async () => ({ data: mockData[table] ?? [] }),
      }),
    }),
  }),
}));

jest.mock('../importedBooksResolve', () => ({
  fetchImportedBookTitles: async () => mockImportedTitles,
}));

import { buildCommunityPayload, ImportedOnlyError } from '../communitySync';

/** One compilation, two quotes: one from a corpus book, one from an imported book
 *  (mobile-synced shape: no passage_id, book_local_id resolved via imported_books). */
function setScenario({ corpusImported = false }: { corpusImported?: boolean } = {}) {
  mockData = {
    tags: [{ id: 't0', name: 'My Compilation', parent_id: null, depth: 0, sort_order: 0 }],
    selection_tags: [
      { tag_id: 't0', selection_id: 'sel-corpus' },
      { tag_id: 't0', selection_id: 'sel-imp' },
    ],
    xrefs: [],
    selections: [
      {
        id: 'sel-corpus', book_local_id: 'book-1',
        start_pid: 'pid-c', end_pid: 'pid-c', start_offset: 0, end_offset: 10,
        snapshot_text: 'Corpus quote', created_at: '2026-01-02T00:00:00.000Z',
        passage_id: 'pass-1',
      },
      {
        id: 'sel-imp', book_local_id: 'imp-1',
        start_pid: 'pid-i', end_pid: 'pid-i', start_offset: 0, end_offset: 5,
        snapshot_text: 'Imported quote', created_at: '2026-01-01T00:00:00.000Z',
        passage_id: null,
      },
    ],
    passages: [
      { id: 'pass-1', book_id: 'book-1', chapter_label: 'Chapter 1', section_title: null, paragraph_number: 3 },
    ],
    books: [
      { id: 'book-1', title: 'Genesis', citation_format: 'bible', is_user_imported: corpusImported, authors: null },
    ],
    notes: [],
  };
  mockImportedTitles = { 'imp-1': 'My Book' };
}

beforeEach(() => {
  mockData = {};
  mockImportedTitles = {};
});

describe('buildCommunityPayload — imported-book handling', () => {
  it("'discover' drops imported quotes and reports the count", async () => {
    setScenario();
    const { tags, selectionCount, droppedImported } = await buildCommunityPayload(['t0'], 'user-1', 'discover');

    expect(droppedImported).toBe(1);
    expect(selectionCount).toBe(1);
    expect(tags).toHaveLength(1);
    expect(tags[0].selections).toHaveLength(1);
    expect(tags[0].selections[0].snapshotText).toBe('Corpus quote');
    expect(tags[0].selections[0].importedReadOnly).toBeUndefined();
  });

  it("'discover' defaults when target is omitted", async () => {
    setScenario();
    const { selectionCount, droppedImported } = await buildCommunityPayload(['t0'], 'user-1');
    expect(selectionCount).toBe(1);
    expect(droppedImported).toBe(1);
  });

  it("'discover' throws ImportedOnlyError when every quote is imported", async () => {
    setScenario({ corpusImported: true });
    await expect(buildCommunityPayload(['t0'], 'user-1', 'discover')).rejects.toBeInstanceOf(ImportedOnlyError);
    await expect(buildCommunityPayload(['t0'], 'user-1', 'discover')).rejects.toThrow(
      "This compilation's quotes are all from imported books, which can't be published to Discover.",
    );
  });

  it("'link' keeps imported quotes, flagged read-only with an empty citation", async () => {
    setScenario();
    const { tags, selectionCount, droppedImported } = await buildCommunityPayload(['t0'], 'user-1', 'link');

    expect(droppedImported).toBe(0);
    expect(selectionCount).toBe(2);
    expect(tags[0].selections).toHaveLength(2);

    const imported = tags[0].selections.find(s => s.snapshotText === 'Imported quote')!;
    expect(imported.importedReadOnly).toBe(true);
    expect(imported.bookTitle).toBe('My Book');
    // Book-only citation, byte-identical with mobile formatCitation('book_only').
    expect(imported.citation).toBe('— My Book.');
    expect(imported.notes).toEqual([]);
    expect(imported.xrefCitations).toEqual([]);

    const corpus = tags[0].selections.find(s => s.snapshotText === 'Corpus quote')!;
    expect(corpus.importedReadOnly).toBeUndefined();
  });

  it('does not throw for a genuinely empty compilation (no selections at all)', async () => {
    setScenario();
    mockData.selection_tags = [];
    mockData.selections = [];
    const { tags, selectionCount, droppedImported } = await buildCommunityPayload(['t0'], 'user-1', 'discover');
    expect(selectionCount).toBe(0);
    expect(droppedImported).toBe(0);
    expect(tags[0].selections).toEqual([]);
  });
});
