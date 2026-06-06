/**
 * Bidirectional annotation sync service for web
 * Mirrors mobile annotationSync.ts for consistent sync across platforms
 */

import { createClient } from './supabase/client';

const supabase = createClient();

export async function pushTag(tag: { id: string; user_id: string; name: string; visibility?: string; updated_at?: string }) {
  try {
    const updated_at = tag.updated_at || new Date().toISOString();
    const { error } = await supabase
      .from('tags')
      .upsert({
        id: tag.id,
        user_id: tag.user_id,
        name: tag.name,
        visibility: tag.visibility ?? 'private',
        updated_at,
      }, { onConflict: 'id' });

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
