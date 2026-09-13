// src/lib/importedBooksResolve.ts
import { createClient } from '@/lib/supabase/client';

/** id → title for the signed-in user's imported books (synced from mobile).
 *  These books have no chapters on the web — only a title to display next to
 *  their quotes. Excludes tombstoned rows (`deleted_at` set) — a book another
 *  device deleted stays in `imported_books` as a tombstone rather than being
 *  hard-deleted (see mobile's `deleteImportedBookRemote` / task_b3d23366), so
 *  without this filter a deleted book's title would keep showing here during
 *  the window before every mobile device has converged. */
export async function fetchImportedBookTitles(userId: string): Promise<Record<string, string>> {
  const supabase = createClient();
  const { data } = await supabase
    .from('imported_books')
    .select('id, title')
    .eq('user_id', userId)
    .is('deleted_at', null);
  const out: Record<string, string> = {};
  for (const r of (data ?? []) as { id: string; title: string }[]) out[r.id] = r.title;
  return out;
}
