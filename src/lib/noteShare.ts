// Note share links (shared_sets kind='notes') — the stored payload shape and
// the book grouping, shared by the exporter, the Notes screen and the public
// /c/<id> page. No client-only imports, so the server page can use it too.
// Mirrored in the mobile app's `src/utils/noteExport.ts` — keep in step.

/** One row of a note share's `payload` (snake_case, as stored in Supabase). */
export interface NoteShareEntry {
  note_id:    string;
  quote:      string;
  note:       string;
  book_title: string;
  citation:   string;
  created_at: string;
}

/** Book groups sorted by title; notes within a book oldest-first (reading a
 *  shared set top to bottom follows the order they were written). */
export function groupNotesByBook<T extends { bookTitle: string; createdAt: string }>(
  entries: T[],
): { bookTitle: string; entries: T[] }[] {
  const byBook = new Map<string, T[]>();
  for (const e of entries) {
    const list = byBook.get(e.bookTitle) ?? [];
    list.push(e);
    byBook.set(e.bookTitle, list);
  }
  return [...byBook.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([bookTitle, list]) => ({
      bookTitle,
      entries: [...list].sort((a, b) => a.createdAt.localeCompare(b.createdAt)),
    }));
}

/** The share page's own grouping: payload rows already arrive in display
 *  order, so this only splits them at each change of book. */
export function splitShareByBook(entries: NoteShareEntry[]): { bookTitle: string; entries: NoteShareEntry[] }[] {
  const out: { bookTitle: string; entries: NoteShareEntry[] }[] = [];
  for (const e of entries) {
    const last = out[out.length - 1];
    if (last && last.bookTitle === e.book_title) last.entries.push(e);
    else out.push({ bookTitle: e.book_title, entries: [e] });
  }
  return out;
}
