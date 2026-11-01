import { groupNotesByBook, splitShareByBook, type NoteShareEntry } from '../noteShare';

describe('groupNotesByBook', () => {
  it('groups by book title, books A–Z, notes oldest-first', () => {
    const rows = [
      { id: 'z2', bookTitle: 'Zeta', createdAt: '2026-02-01' },
      { id: 'a1', bookTitle: 'Alpha', createdAt: '2026-03-01' },
      { id: 'z1', bookTitle: 'Zeta', createdAt: '2026-01-01' },
    ];
    const groups = groupNotesByBook(rows);
    expect(groups.map(g => g.bookTitle)).toEqual(['Alpha', 'Zeta']);
    expect(groups[1].entries.map(e => e.id)).toEqual(['z1', 'z2']);
  });
});

describe('splitShareByBook', () => {
  const e = (id: string, book: string): NoteShareEntry => ({
    note_id: id, quote: 'q', note: 'n', book_title: book, citation: '', created_at: '',
  });
  it('splits stored rows at each change of book, keeping order', () => {
    const out = splitShareByBook([e('1', 'A'), e('2', 'A'), e('3', 'B')]);
    expect(out.map(g => [g.bookTitle, g.entries.map(x => x.note_id)])).toEqual([['A', ['1', '2']], ['B', ['3']]]);
  });
});
