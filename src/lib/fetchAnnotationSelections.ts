/**
 * Shared helper: given a list of selection IDs (or a user_id),
 * returns a map of selectionId → { snapshot_text, passage_id, book_id, citation }.
 *
 * Fetches in three separate queries (selections → passages → books) to avoid
 * relying on PostgREST FK join inference.
 */
import { createClient } from '@/lib/supabase/client';

export interface SelInfo {
  snapshot_text: string;
  passage_id:    string;
  book_id:       string;
  citation:      string;
}

function buildCitation(passage: any, book: any, author: any): string {
  return [
    author?.name,
    book?.title,
    passage?.chapter_label || passage?.section_title,
    passage?.paragraph_number ? `p.${passage.paragraph_number}` : null,
  ].filter(Boolean).join(', ');
}

export async function fetchSelectionsByUser(userId: string): Promise<Record<string, SelInfo>> {
  const supabase = createClient();

  // 1. All user's selections — only user_id filter, no joins (avoids RLS/FK issues)
  const { data: selData } = await supabase
    .from('selections')
    .select('id, snapshot_text, passage_id')
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
    .select('id, title, authors(name)')
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
      citation:      buildCitation(passage, book, author),
    };
  }
  return result;
}
