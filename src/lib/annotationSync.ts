/**
 * Bidirectional annotation sync service for web
 * Mirrors mobile annotationSync.ts for consistent sync across platforms
 */

import { createClient } from './supabase/client';

const supabase = createClient();

export async function pushTag(tag: { id: string; user_id: string; name: string; visibility?: string; updated_at?: string; parent_id?: string | null; depth?: number; sort_order?: number }) {
  try {
    const updated_at = tag.updated_at || new Date().toISOString();
    const row: Record<string, unknown> = {
      id: tag.id,
      user_id: tag.user_id,
      name: tag.name,
      visibility: tag.visibility ?? 'private',
      updated_at,
    };
    // Only include hierarchy fields when provided (reorder/re-parent writes).
    if (tag.parent_id !== undefined) row.parent_id = tag.parent_id;
    if (tag.depth !== undefined) row.depth = tag.depth;
    if (tag.sort_order !== undefined) row.sort_order = tag.sort_order;
    const { error } = await supabase
      .from('tags')
      .upsert(row, { onConflict: 'id' });

    if (error) console.warn('pushTag error:', error);
    return !error;
  } catch (e) {
    console.warn('pushTag exception:', e);
    return false;
  }
}

export async function pushNote(note: { id: string; user_id: string; selection_id: string; content: string; updated_at?: string }) {
  try {
    const updated_at = note.updated_at || new Date().toISOString();
    const { error } = await supabase
      .from('notes')
      .upsert({
        id: note.id,
        user_id: note.user_id,
        selection_id: note.selection_id,
        content: note.content,
        updated_at,
      }, { onConflict: 'id' });

    if (error) console.warn('pushNote error:', error);
    return !error;
  } catch (e) {
    console.warn('pushNote exception:', e);
    return false;
  }
}

export async function pushSelection(selection: { id: string; user_id: string; passage_id: string; book_local_id?: string | null; start_pid?: string | null; end_pid?: string | null; anchor_schema_version?: number; start_offset: number; end_offset: number; snapshot_text: string; updated_at?: string }) {
  try {
    const updated_at = selection.updated_at || new Date().toISOString();
    const { error } = await supabase
      .from('selections')
      .upsert({
        id:                    selection.id,
        user_id:               selection.user_id,
        passage_id:            selection.passage_id,
        book_local_id:         selection.book_local_id ?? null,
        start_pid:             selection.start_pid ?? null,
        end_pid:               selection.end_pid ?? null,
        anchor_schema_version: selection.anchor_schema_version ?? 1,
        start_offset:          selection.start_offset,
        end_offset:            selection.end_offset,
        snapshot_text:         selection.snapshot_text,
        updated_at,
      }, { onConflict: 'id' });

    if (error) console.warn('pushSelection error:', error);
    return !error;
  } catch (e) {
    console.warn('pushSelection exception:', e);
    return false;
  }
}

export async function pushSelectionTag(st: { id: string; tag_id: string; selection_id: string; created_at?: string }) {
  try {
    const { error } = await supabase
      .from('selection_tags')
      .upsert({
        id:           st.id,
        tag_id:       st.tag_id,
        selection_id: st.selection_id,
        created_at:   st.created_at ?? new Date().toISOString(),
      }, { onConflict: 'id' });

    if (error) console.warn('pushSelectionTag error:', error);
    return !error;
  } catch (e) {
    console.warn('pushSelectionTag exception:', e);
    return false;
  }
}

export async function pushXref(xref: { id: string; user_id: string; selection_a_id: string; selection_b_id: string; label?: string | null; updated_at?: string }) {
  try {
    const updated_at = xref.updated_at || new Date().toISOString();
    const { error } = await supabase
      .from('xrefs')
      .upsert({
        id: xref.id,
        user_id: xref.user_id,
        selection_a_id: xref.selection_a_id,
        selection_b_id: xref.selection_b_id,
        label: xref.label ?? null,
        updated_at,
      }, { onConflict: 'id' });

    if (error) console.warn('pushXref error:', error);
    return !error;
  } catch (e) {
    console.warn('pushXref exception:', e);
    return false;
  }
}

/**
 * Delete a selection once nothing hangs off it — no note, no cross-reference,
 * no compilation link — so deleting its last annotation doesn't leave a bare
 * highlight behind. Mirrors mobile's cleanupOrphanedSelection. Any failed
 * lookup keeps the selection: never delete on an uncertain answer.
 */
export async function cleanupOrphanedSelection(selectionId: string | null | undefined) {
  if (!selectionId) return;
  try {
    const count = (table: string, column: string) =>
      supabase.from(table).select('id', { count: 'exact', head: true }).eq(column, selectionId);
    const results = await Promise.all([
      count('notes', 'selection_id'),
      count('xrefs', 'selection_a_id'),
      count('xrefs', 'selection_b_id'),
      count('selection_tags', 'selection_id'),
    ]);
    if (results.some(r => r.error || r.count === null)) return;
    if (results.every(r => r.count === 0)) await deleteRemote('selections', selectionId);
  } catch {
    /* keep it */
  }
}

export async function deleteRemote(table: 'tags' | 'notes' | 'xrefs' | 'selections', id: string) {
  try {
    const { error } = await supabase
      .from(table)
      .delete()
      .eq('id', id);

    if (error) console.warn(`deleteRemote(${table}) error:`, error);
    return !error;
  } catch (e) {
    console.warn(`deleteRemote(${table}) exception:`, e);
    return false;
  }
}
