'use client';

import { createClient } from '@/lib/supabase/client';
import {
  buildCommunityPayload,
  resolvePassageIds,
  writeLocalTagTree,
  type ImmTagExport,
} from './communitySync';

export interface Tradition { id: string; name: string }
export interface TraditionPair { pairKey: string; pairName: string }

/** Order-independent, duplicate-insensitive set equality for xref id lists. */
export function xrefIdSetEquals(a: string[], b: string[]): boolean {
  const sa = new Set(a);
  const sb = new Set(b);
  if (sa.size !== sb.size) return false;
  for (const id of sa) if (!sb.has(id)) return false;
  return true;
}

/** Normalise a pair of traditions so A↔B and B↔A collapse to one bucket.
 *  Mirrors XRefsScreen / xrefExport exactly (sort by name; key by id in name order). */
export function traditionPairOf(a: Tradition, b: Tradition): TraditionPair {
  const [nameFirst, nameSecond] = [a.name, b.name].sort();
  const [idFirst, idSecond] = a.name <= b.name ? [a.id, b.id] : [b.id, a.id];
  return {
    pairKey: `${idFirst}↔${idSecond}`,
    pairName: nameFirst === nameSecond ? `${nameFirst} ↔ ${nameFirst}` : `${nameFirst} ↔ ${nameSecond}`,
  };
}

// ─── shared_sets I/O ──────────────────────────────────────────────────────────
//
// ⚠️ `shared_sets_compilation_uniq` is a PARTIAL EXPRESSION index
// (`(owner_id, (ref->>'tag_id')) where kind = 'compilation'`). PostgREST's
// `onConflict` emits each entry as a quoted identifier, so
// `{ onConflict: 'owner_id,(ref->>tag_id)' }` becomes
// `ON CONFLICT (owner_id, "(ref->>tag_id)")` — verified against the live DB to
// fail with `42703 column "(ref->>tag_id)" does not exist`. Every compilation
// share write therefore uses an explicit select-then-insert-or-update instead.
// (The JSON-path *filter* `.eq('ref->>tag_id', v)` IS supported — verified live.)

type SubtreeRow = { id: string; parent_id: string | null };

/** Local copy of communitySync's getSubtreeIds (not exported there). */
function getSubtreeIdsPublic(rootId: string, allTags: SubtreeRow[]): string[] {
  const result = [rootId];
  const queue = [rootId];
  while (queue.length) {
    const cur = queue.shift()!;
    for (const k of allTags.filter(t => t.parent_id === cur)) { result.push(k.id); queue.push(k.id); }
  }
  return result;
}

/** Build the current ImmTagExport[] snapshot for a compilation subtree. */
async function buildSnapshot(
  supabase: ReturnType<typeof createClient>,
  tagId: string,
  userId: string,
) {
  const { data: allTagsData } = await supabase.from('tags').select('id, parent_id').eq('user_id', userId);
  const subtreeIds = getSubtreeIdsPublic(tagId, (allTagsData ?? []) as SubtreeRow[]);
  return buildCommunityPayload(subtreeIds, userId);
}

/** Rebuild the payload snapshot of a compilation's shared_sets row, if one exists.
 *  No-op when the compilation is not shared. Fire-and-forget from call sites. */
export async function refreshSharedCompilation(tagId: string, userId: string): Promise<void> {
  const supabase = createClient();
  const { data: row } = await supabase
    .from('shared_sets')
    .select('id')
    .eq('owner_id', userId)
    .eq('kind', 'compilation')
    .eq('ref->>tag_id', tagId)
    .maybeSingle();
  if (!row) return;

  const { tags, selectionCount } = await buildSnapshot(supabase, tagId, userId);

  await supabase.from('shared_sets').update({
    payload: tags,
    item_count: selectionCount,
    updated_at: new Date().toISOString(),
  }).eq('id', (row as { id: string }).id);
}

/** Ensure a link-only compilation share exists (shared_sets only — never touches
 *  community_tags, so creating a link does not publish to Discover). Idempotent. */
export async function ensureCompilationShare(
  supabase: ReturnType<typeof createClient>,
  rootTag: { id: string; name: string },
  userId: string,
): Promise<{ id: string }> {
  const { data: existing } = await supabase
    .from('shared_sets').select('id')
    .eq('owner_id', userId).eq('kind', 'compilation').eq('ref->>tag_id', rootTag.id).maybeSingle();
  if (existing) return { id: (existing as { id: string }).id };

  const { tags, selectionCount } = await buildSnapshot(supabase, rootTag.id, userId);

  const { data: row, error } = await supabase.from('shared_sets').insert({
    owner_id: userId, kind: 'compilation', title: rootTag.name,
    ref: { tag_id: rootTag.id }, payload: tags, item_count: selectionCount,
  }).select('id').single();
  if (error) throw error;
  return { id: (row as { id: string }).id };
}

/** One-time copy of a shared compilation into the caller's own Compilations
 *  (no subscription). Port of Phase 5's copyCommunityTag, reading
 *  `shared_sets.payload` and recording the copy in `shared_set_copies`. */
export async function copySharedCompilation(sharedSetId: string, userId: string): Promise<string> {
  const supabase = createClient();
  const { data: existing } = await supabase
    .from('shared_set_copies').select('local_root_ref')
    .eq('subscriber_id', userId).eq('shared_set_id', sharedSetId).eq('kind', 'compilation').maybeSingle();
  if (existing?.local_root_ref) {
    const { data: still } = await supabase
      .from('tags').select('id').eq('id', existing.local_root_ref as string).maybeSingle();
    if (still) return existing.local_root_ref as string;
  }

  const { data: ss } = await supabase
    .from('shared_sets').select('payload').eq('id', sharedSetId).eq('kind', 'compilation').maybeSingle();
  if (!ss?.payload) throw new Error('shared compilation not found');

  const rootLocalTagId = await writeLocalTagTree(supabase, ss.payload as ImmTagExport[], userId, 'private');
  await supabase.from('shared_set_copies').upsert(
    { subscriber_id: userId, shared_set_id: sharedSetId, kind: 'compilation', local_root_ref: rootLocalTagId },
    { onConflict: 'subscriber_id,shared_set_id' },   // plain unique index — supported
  );
  return rootLocalTagId;
}

// ─── Shared cross-reference sets (kind='xrefs') ───────────────────────────────

export interface XrefShareSide {
  snapshot_text: string;
  passage_id: string | null;
  book_local_id: string | null;
  start_pid: string | null;
}
export interface XrefShareEntry {
  xref_id: string;
  label: string | null;
  created_at: string;
  a: XrefShareSide;
  b: XrefShareSide;
}
export interface XrefShareSet {
  id: string;
  kind: 'xrefs';
  title: string;
  updated_at: string;
  content: XrefShareEntry[];
}

/** Live-render an xref share via the SECURITY DEFINER RPC. Anonymous-callable.
 *  Returns null for a missing / non-`xrefs` / malformed id (the page then 404s). */
export async function getSharedXrefSet(sharedSetId: string): Promise<XrefShareSet | null> {
  const supabase = createClient();
  const { data, error } = await supabase.rpc('get_shared_xref_set', { share_id: sharedSetId });
  if (error || !data) return null;
  return data as XrefShareSet;
}

export interface SaveXrefsResult { saved: number; skipped: number; total: number }

/**
 * One-time copy of a shared cross-reference set into the viewer's own library.
 * Idempotent via `shared_set_copies`. Pairs whose books this catalogue doesn't
 * serve are skipped rather than failing the whole save.
 */
export async function saveSharedXrefs(sharedSetId: string, userId: string): Promise<SaveXrefsResult> {
  const supabase = createClient();

  const { data: prior } = await supabase
    .from('shared_set_copies').select('local_root_ref')
    .eq('subscriber_id', userId).eq('shared_set_id', sharedSetId).eq('kind', 'xrefs').maybeSingle();
  if (prior?.local_root_ref) {
    const ids: string[] = JSON.parse(prior.local_root_ref as string);
    return { saved: ids.length, skipped: 0, total: ids.length };
  }

  const set = await getSharedXrefSet(sharedSetId);
  if (!set) throw new Error('shared cross-references not found');
  const entries = set.content;

  // Which books does this viewer actually have on web? Every book in book_slug_map is servable.
  const localIds = [...new Set(entries.flatMap(e => [e.a.book_local_id, e.b.book_local_id]).filter(Boolean) as string[])];
  const { data: slugRows } = localIds.length
    ? await supabase.from('book_slug_map').select('local_id').in('local_id', localIds)
    : { data: [] };
  const haveBook = new Set((slugRows ?? []).map((r: { local_id: string }) => r.local_id));

  // Resolve every pid → web passage_id for the selections rows we'll write.
  const pidMap = await resolvePassageIds(
    supabase,
    entries.flatMap(e => [e.a.start_pid, e.b.start_pid]).filter(Boolean) as string[],
  );

  const now = new Date().toISOString();
  const selRows: Record<string, unknown>[] = [];
  const xrefRows: Record<string, unknown>[] = [];
  const createdXrefIds: string[] = [];
  let skipped = 0;

  for (const e of entries) {
    if (!e.a.book_local_id || !e.b.book_local_id || !haveBook.has(e.a.book_local_id) || !haveBook.has(e.b.book_local_id)) {
      skipped++; continue;
    }
    const aId = crypto.randomUUID();
    const bId = crypto.randomUUID();
    const mk = (id: string, side: XrefShareSide) => ({
      id, user_id: userId, book_local_id: side.book_local_id,
      passage_id: side.start_pid ? (pidMap[side.start_pid] ?? null) : null,
      start_pid: side.start_pid, end_pid: side.start_pid,
      start_offset: 0, end_offset: 0, snapshot_text: side.snapshot_text,
      anchor_schema_version: 1, created_at: now, updated_at: now,
    });
    selRows.push(mk(aId, e.a), mk(bId, e.b));
    // selection_a_id < selection_b_id, enforced as everywhere else.
    const [lo, hi] = aId < bId ? [aId, bId] : [bId, aId];
    const xrefId = crypto.randomUUID();
    xrefRows.push({ id: xrefId, user_id: userId, selection_a_id: lo, selection_b_id: hi, label: e.label ?? null, created_at: now, updated_at: now });
    createdXrefIds.push(xrefId);
  }

  if (selRows.length) {
    const { error: se } = await supabase.from('selections').insert(selRows);
    if (se) throw se;
    const { error: xe } = await supabase.from('xrefs').insert(xrefRows);
    if (xe) throw xe;
  }

  await supabase.from('shared_set_copies').upsert(
    { subscriber_id: userId, shared_set_id: sharedSetId, kind: 'xrefs', local_root_ref: JSON.stringify(createdXrefIds) },
    { onConflict: 'subscriber_id,shared_set_id' },
  );

  return { saved: createdXrefIds.length, skipped, total: entries.length };
}
