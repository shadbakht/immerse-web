/**
 * Shared helper: given a list of selection IDs (or a user_id),
 * returns a map of selectionId → { snapshot_text, passage_id, book_id, citation }.
 *
 * Fetches in three separate queries (selections → passages → books) to avoid
 * relying on PostgREST FK join inference.
 */
import { createClient } from '@/lib/supabase/client';
import { buildCitation } from '@/lib/citationUtils';
import { fetchImportedBookTitles } from '@/lib/importedBooksResolve';

export interface SelInfo {
  snapshot_text: string;
  passage_id:    string;
  book_id:       string;
  book_title:    string;
  citation:      string;
  /** True for a selection on a synced imported book: it has a real title to
   *  show, but there is no web reader for it, so "open in reader" must be
   *  suppressed. */
  importedReadOnly?: boolean;
}

export async function fetchSelectionsByUser(userId: string): Promise<Record<string, SelInfo>> {
  const supabase = createClient();

  // 1. All user's selections — only user_id filter, no joins (avoids RLS/FK issues)
  const { data: selData } = await supabase
    .from('selections')
    .select('id, snapshot_text, passage_id, book_local_id')
    .eq('user_id', userId);
  if (!selData?.length) return {};

  // 2. Fetch passage metadata for those passage IDs
  const passageIds = [...new Set(selData.map((s: any) => s.passage_id).filter(Boolean))];
  const { data: passData } = await supabase
    .from('passages')
    .select('id, book_id, chapter_label, section_title, paragraph_number')
    .in('id', passageIds);
  const passMap: Record<string, any> = {};
  for (const p of (passData ?? []) as any[]) passMap[p.id] = p;

  // 3. Fetch book + author info for those book IDs
  const bookIds = [...new Set(Object.values(passMap).map((p: any) => p.book_id).filter(Boolean))];
  const { data: bookData } = await supabase
    .from('books')
    .select('id, title, citation_format, authors(name)')
    .in('id', bookIds);
  const bookMap: Record<string, any> = {};
  for (const b of (bookData ?? []) as any[]) bookMap[b.id] = b;

  // 4. Assemble map
  const result: Record<string, SelInfo> = {};
  for (const sel of selData as any[]) {
    const passage = passMap[sel.passage_id];
    const book    = passage ? bookMap[passage.book_id] : null;
    const author  = (book?.authors as any);
    result[sel.id] = {
      snapshot_text: sel.snapshot_text ?? '',
      passage_id:    sel.passage_id    ?? '',
      book_id:       passage?.book_id  ?? '',
      book_title:    book?.title       ?? '',
      citation:      buildCitation(passage, book, (author as any)?.name),
    };
  }

  // Imported-book selections (passage_id null, book_local_id = a device id not
  // in the catalog): fill in the real title from imported_books; there is no
  // web reader for them, so mark them read-only.
  const needsImported = (selData as any[]).some(s => !s.passage_id && s.book_local_id);
  if (needsImported) {
    const titles = await fetchImportedBookTitles(userId);
    for (const sel of selData as any[]) {
      if (!sel.passage_id && sel.book_local_id && titles[sel.book_local_id]) {
        result[sel.id].book_title       = titles[sel.book_local_id];
        result[sel.id].book_id          = sel.book_local_id;   // a device id, NOT a catalog uuid
        result[sel.id].importedReadOnly = true;
      }
    }
  }

  return result;
}
