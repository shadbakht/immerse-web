// src/lib/importedBooksResolve.ts
import { createClient } from '@/lib/supabase/client';

/** id → title for the signed-in user's imported books (synced from mobile).
 *  These books have no chapters on the web — only a title to display next to
 *  their quotes. */
export async function fetchImportedBookTitles(userId: string): Promise<Record<string, string>> {
  const supabase = createClient();
  const { data } = await supabase
    .from('imported_books')
    .select('id, title')
    .eq('user_id', userId);
  const out: Record<string, string> = {};
  for (const r of (data ?? []) as { id: string; title: string }[]) out[r.id] = r.title;
  return out;
}
