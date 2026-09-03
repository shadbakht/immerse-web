'use client';

import { translate } from '@immerse/i18n';
import { createClient } from '@/lib/supabase/client';
import { buildCitation } from '@/lib/citationUtils';
import { getStoredUiLanguage } from '@/lib/language';

/**
 * Thrown by `buildCommunityPayload(..., 'discover')` when every selection in a
 * compilation that HAD selections comes from an imported book, so publishing to
 * Discover would produce an empty compilation. Mirrors mobile's `ImportedOnlyError`
 * — both platforms resolve the same i18n key against the viewer's UI language.
 */
export class ImportedOnlyError extends Error {
  constructor() {
    super(translate(getStoredUiLanguage(), 'discover.importedOnlyError'));
    this.name = 'ImportedOnlyError';
  }
}

/** True when a shared payload has selections but every one is an imported-book
 *  quote (importedReadOnly) — nothing can be copied into a recipient's library. */
export function isViewOnlyPayload(payload: ImmTagExport[]): boolean {
  let total = 0, readOnly = 0;
  for (const t of payload) for (const s of (t.selections ?? [])) { total++; if (s.importedReadOnly) readOnly++; }
  return total > 0 && readOnly === total;
}

/**
 * Thrown by `importCommunityTag` / `copySharedCompilation` when the payload is
 * view-only (every quote is `importedReadOnly`), so a recipient copy would write
 * nothing. Mirrors mobile's `ViewOnlyShareError` — both platforms resolve the
 * same i18n key against the viewer's UI language.
 */
export class ViewOnlyShareError extends Error {
  constructor() {
    super(translate(getStoredUiLanguage(), 'sharePage.viewOnly'));
    this.name = 'ViewOnlyShareError';
  }
}

export interface ImmTagExport {
  exportId:       string;
  parentExportId: string | null;
  name:           string;
  depth:          number;
  sortOrder:      number;
  selections: {
    startPid:     string;
    startOffset:  number;
    endPid:       string;
    endOffset:    number;
    snapshotText: string;
    bookId:       string;
    createdAt:    string;
    /** Set on a 'link'-target snapshot when the quote is from an imported book:
     *  the importer keeps it read-only (no chapters on the web) instead of
     *  trying to anchor it. Absent on 'discover' payloads (those drop it). */
    importedReadOnly?: boolean;
  }[];
}

export interface CommunityTagRow {
  id:              string;
  user_id:         string;
  name:            string;
  payload:         ImmTagExport[];
  selection_count: number;
  published_at:    string;
  updated_at:      string;
}

const COMMUNITY_TAG_FIELDS = 'id, user_id, name, payload, selection_count, published_at, updated_at';

// ─── Private helpers ──────────────────────────────────────────────────────────

type LocalTag = { id: string; name: string; parent_id: string | null };

function buildTagIdMap(
  payloadTags: ImmTagExport[],
  rootLocalTagId: string,
  allLocalTags: LocalTag[],
): Map<string, string> {
  const result = new Map<string, string>();
  const byParent = new Map<string | null, LocalTag[]>();
  for (const t of allLocalTags) {
    const key = t.parent_id ?? null;
    if (!byParent.has(key)) byParent.set(key, []);
    byParent.get(key)!.push(t);
  }

  function match(exportParentId: string | null, localParentId: string | null) {
    const exported  = payloadTags.filter(t => t.parentExportId === exportParentId);
    const localList = byParent.get(localParentId) ?? [];
    for (const exp of exported) {
      const local = localList.find(t => t.name === exp.name);
      if (!local) continue;
      result.set(exp.exportId, local.id);
      match(exp.exportId, local.id);
    }
  }

  const rootExport = payloadTags.find(t => t.parentExportId === null);
  const rootLocal  = allLocalTags.find(t => t.id === rootLocalTagId);
  if (rootExport && rootLocal) {
    result.set(rootExport.exportId, rootLocal.id);
    match(rootExport.exportId, rootLocal.id);
  }
  return result;
}

// ─── Publisher ──────────────────────────────────────────────────────────────────
// Mirrors mobile buildImmPayload + publishTag/unpublishTag so a tag published from
// the web produces a byte-compatible payload that subscribers on either platform
// import identically.

interface PublishSelection {
  snapshotText:  string;
  bookId:        string;
  bookTitle:     string;
  citation:      string;      // raw "— …." form, matching mobile formatCitation
  notes:         string[];
  xrefCitations: string[];
  importedReadOnly?: boolean;  // 'link' target only — quote is from an imported book
  startPid:      string;
  startOffset:   number;
  endPid:        string;
  endOffset:     number;
  createdAt:     string;
}

interface PublishTagExport {
  exportId:       string;
  name:           string;
  color:          string | null;
  parentExportId: string | null;
  depth:          number;
  sortOrder:      number;
  selections:     PublishSelection[];
}

export type TagSubtreeRow = { id: string; parent_id: string | null };

/** Collect a tag's id plus all descendant ids from a flat parent_id list (BFS). */
export function getSubtreeIds(rootId: string, allTags: TagSubtreeRow[]): string[] {
  const result = [rootId];
  const queue  = [rootId];
  while (queue.length > 0) {
    const cur = queue.shift()!;
    for (const k of allTags.filter(t => t.parent_id === cur)) {
      result.push(k.id);
      queue.push(k.id);
    }
  }
  return result;
}

/** Wrap a passage+book into the mobile "— …." citation form. */
function rawCitation(passage: any, book: any): string {
  return `— ${buildCitation(passage, book, book?.authors?.name ?? null)}.`;
}

/**
 * Build the ImmTagExport[] community payload for a tag subtree.
 * Groups selections by paragraph (startPid) and attaches citations, notes, and
 * xref citations — exactly like mobile buildImmPayload.
 *
 * `target` decides how imported-book selections are handled, mirroring mobile's
 * `buildCompilationSnapshot(..., target)`:
 *   - 'discover' (default): drop them. If that empties a compilation that HAD
 *     selections, throw `ImportedOnlyError`.
 *   - 'link': keep them, each flagged `importedReadOnly: true`, with a book-only
 *     citation ("— <title>.", matching mobile's `formatCitation` for
 *     `citationFormat: 'book_only'`). `droppedImported` stays 0.
 *
 * An imported selection is one whose book row is `is_user_imported`, OR — the
 * mobile-synced shape web can't see as a `books` row — a selection with no
 * `passage_id` whose `book_local_id` is a known `imported_books` id.
 */
export async function buildCommunityPayload(
  subtreeTagIds: string[],
  userId: string,
  target: 'discover' | 'link' = 'discover',
): Promise<{ tags: PublishTagExport[]; selectionCount: number; droppedImported: number }> {
  const supabase = createClient();
  const { fetchImportedBookTitles } = await import('./importedBooksResolve');
  const importedTitles = await fetchImportedBookTitles(userId);

  // 1. Subtree tag rows, kept in subtree (BFS) order for stable exportIds.
  const { data: tagRows } = await supabase
    .from('tags')
    .select('id, name, parent_id, depth, sort_order')
    .in('id', subtreeTagIds);
  const tagById = new Map<string, any>();
  for (const t of (tagRows ?? []) as any[]) tagById.set(t.id, t);
  const orderedTags = subtreeTagIds.map(id => tagById.get(id)).filter(Boolean);

  const exportIdMap: Record<string, string> = {};
  orderedTags.forEach((t, i) => { exportIdMap[t.id] = `t${i}`; });

  // 2. selection_tags for the subtree → selection ids per tag.
  const { data: stRows } = await supabase
    .from('selection_tags')
    .select('tag_id, selection_id')
    .in('tag_id', subtreeTagIds);
  const selIdsByTag = new Map<string, string[]>();
  const subtreeSelIds = new Set<string>();
  for (const st of (stRows ?? []) as any[]) {
    if (!selIdsByTag.has(st.tag_id)) selIdsByTag.set(st.tag_id, []);
    selIdsByTag.get(st.tag_id)!.push(st.selection_id);
    subtreeSelIds.add(st.selection_id);
  }
  const subtreeSelIdList = [...subtreeSelIds];

  // 3. xrefs touching the subtree selections (need the "other" side for citations).
  const xrefTargetsBySel = new Map<string, Set<string>>();
  const xrefTargetIds = new Set<string>();
  if (subtreeSelIdList.length) {
    const inList = subtreeSelIdList.join(',');
    const { data: xrefRows } = await supabase
      .from('xrefs')
      .select('selection_a_id, selection_b_id')
      .or(`selection_a_id.in.(${inList}),selection_b_id.in.(${inList})`);
    for (const x of (xrefRows ?? []) as any[]) {
      const link = (selId: string, otherId: string) => {
        if (!subtreeSelIds.has(selId)) return;
        if (!xrefTargetsBySel.has(selId)) xrefTargetsBySel.set(selId, new Set());
        xrefTargetsBySel.get(selId)!.add(otherId);
        xrefTargetIds.add(otherId);
      };
      link(x.selection_a_id, x.selection_b_id);
      link(x.selection_b_id, x.selection_a_id);
    }
  }

  // 4. Bulk-fetch every selection we touch (subtree + xref targets) and its metadata.
  const allSelIds = [...new Set([...subtreeSelIdList, ...xrefTargetIds])];
  const selMap: Record<string, any> = {};
  if (allSelIds.length) {
    const { data: selData } = await supabase
      .from('selections')
      .select('id, book_local_id, start_pid, end_pid, start_offset, end_offset, snapshot_text, created_at, passage_id')
      .in('id', allSelIds);
    for (const s of (selData ?? []) as any[]) selMap[s.id] = s;
  }

  const passageIds = [...new Set(Object.values(selMap).map((s: any) => s.passage_id).filter(Boolean))];
  const passMap: Record<string, any> = {};
  if (passageIds.length) {
    const { data: passData } = await supabase
      .from('passages')
      .select('id, book_id, chapter_label, section_title, paragraph_number')
      .in('id', passageIds);
    for (const p of (passData ?? []) as any[]) passMap[p.id] = p;
  }

  const bookIds = [...new Set(Object.values(passMap).map((p: any) => p.book_id).filter(Boolean))];
  const bookMap: Record<string, any> = {};
  if (bookIds.length) {
    const { data: bookData } = await supabase
      .from('books')
      .select('id, title, citation_format, is_user_imported, authors(name)')
      .in('id', bookIds);
    for (const b of (bookData ?? []) as any[]) bookMap[b.id] = b;
  }

  const noteMap: Record<string, string> = {};
  if (subtreeSelIdList.length) {
    const { data: noteData } = await supabase
      .from('notes')
      .select('selection_id, content')
      .in('selection_id', subtreeSelIdList);
    for (const n of (noteData ?? []) as any[]) noteMap[n.selection_id] = n.content;
  }

  // 5. Assemble each tag's selections, grouped by paragraph like mobile.
  const tagExports: PublishTagExport[] = [];
  let selectionCount = 0;
  let droppedImported = 0;
  let rawTotalSelectionsSeen = 0;

  for (const tag of orderedTags) {
    type RawSel = PublishSelection & { _note: string | null };
    const rawSels: RawSel[] = [];

    for (const selId of (selIdsByTag.get(tag.id) ?? [])) {
      const sel = selMap[selId];
      if (!sel) continue;
      rawTotalSelectionsSeen++;
      const passage = sel.passage_id ? passMap[sel.passage_id] : null;
      const book    = passage ? bookMap[passage.book_id] : null;

      // Imported iff the book row says so, OR (mobile-synced shape) a pidless
      // selection whose book_local_id is a known imported_books id.
      const isImported =
        !!book?.is_user_imported ||
        (!sel.passage_id && !!sel.book_local_id && !!importedTitles[sel.book_local_id]);
      if (isImported && target === 'discover') { droppedImported++; continue; }

      const xrefCitations: string[] = [];
      for (const targetId of (xrefTargetsBySel.get(selId) ?? [])) {
        const ts = selMap[targetId];
        if (!ts) continue;
        const tp = ts.passage_id ? passMap[ts.passage_id] : null;
        const tb = tp ? bookMap[tp.book_id] : null;
        if (!tb) continue;
        xrefCitations.push(rawCitation(tp, tb));
      }

      rawSels.push({
        snapshotText:  sel.snapshot_text ?? '',
        bookId:        sel.book_local_id ?? '',
        bookTitle:     isImported
          ? (importedTitles[sel.book_local_id] ?? book?.title ?? sel.book_local_id ?? '')
          : (book?.title ?? sel.book_local_id ?? ''),
        // Imported books have no chapters on the web; mirror mobile's
        // `formatCitation` for `citationFormat: 'book_only'` — "— <title>.".
        citation:      isImported
          ? (importedTitles[sel.book_local_id] ? `— ${importedTitles[sel.book_local_id]}.` : '')
          : rawCitation(passage, book),
        importedReadOnly: isImported ? true : undefined,
        notes:         [],
        _note:         noteMap[selId] ?? null,
        xrefCitations,
        startPid:      sel.start_pid ?? '',
        startOffset:   sel.start_offset ?? 0,
        endPid:        sel.end_pid ?? sel.start_pid ?? '',
        endOffset:     sel.end_offset ?? 0,
        createdAt:     sel.created_at,
      });
    }

    // Newest first, matching the Tags screen order.
    rawSels.sort((a, b) => b.createdAt.localeCompare(a.createdAt));

    // Group by startPid: merge same-paragraph selections into one block, keeping
    // the longest quote and collecting each sub-selection's note + xref citations.
    const pidGroups = new Map<string, RawSel[]>();
    for (const s of rawSels) {
      if (!pidGroups.has(s.startPid)) pidGroups.set(s.startPid, []);
      pidGroups.get(s.startPid)!.push(s);
    }

    const selExports: PublishSelection[] = [];
    for (const group of pidGroups.values()) {
      const primary = group.reduce((best, cur) =>
        cur.snapshotText.length > best.snapshotText.length ? cur : best,
      );
      // Privacy: notes and cross-references are never made public.
      selExports.push({
        snapshotText:  primary.snapshotText,
        bookId:        primary.bookId,
        bookTitle:     primary.bookTitle,
        citation:      primary.citation,
        importedReadOnly: primary.importedReadOnly,
        notes:         [],
        xrefCitations: [],
        startPid:      primary.startPid,
        startOffset:   primary.startOffset,
        endPid:        primary.endPid,
        endOffset:     primary.endOffset,
        createdAt:     group[0].createdAt,
      });
    }

    selectionCount += selExports.length;
    tagExports.push({
      exportId:       exportIdMap[tag.id],
      name:           tag.name,
      color:          null,
      parentExportId: tag.parent_id ? (exportIdMap[tag.parent_id] ?? null) : null,
      depth:          tag.depth,
      sortOrder:      tag.sort_order,
      selections:     selExports,
    });
  }

  // An all-imported compilation empties out under 'discover' — signal the caller
  // so it can revert its toggle and explain why (mobile throws the same error).
  if (target === 'discover' && rawTotalSelectionsSeen > 0 && selectionCount === 0) {
    throw new ImportedOnlyError();
  }

  return { tags: tagExports, selectionCount, droppedImported };
}

/**
 * Push a tag + its full subtree to the community (idempotent upsert).
 * Mirrors mobile publishTag. Returns `droppedImported` — how many imported-book
 * selections were left out of the Discover payload. Propagates `ImportedOnlyError`
 * when every selection was imported.
 */
export async function publishTag(
  rootTag: { id: string; name: string },
  userId: string,
  opts: { listed?: boolean } = {},
): Promise<{ droppedImported: number }> {
  const supabase = createClient();
  const { data: allTagsData } = await supabase
    .from('tags')
    .select('id, parent_id')
    .eq('user_id', userId);
  const subtreeIds = getSubtreeIds(rootTag.id, (allTagsData ?? []) as TagSubtreeRow[]);

  const { tags, selectionCount, droppedImported } = await buildCommunityPayload(subtreeIds, userId, 'discover');

  const { error } = await supabase
    .from('community_tags')
    .upsert(
      {
        user_id:         userId,
        tag_id:          rootTag.id,
        name:            rootTag.name,
        payload:         tags,
        selection_count: selectionCount,
        listed:          opts.listed ?? true,
        updated_at:      new Date().toISOString(),
      },
      { onConflict: 'user_id,tag_id' },
    );
  if (error) throw error;

  // Phase 8: keep the canonical shared_sets row in step (payload + FK).
  // NOTE: `shared_sets_compilation_uniq` is a PARTIAL EXPRESSION index, which
  // PostgREST's `onConflict` cannot target (it quotes each entry as an
  // identifier → `42703 column "(ref->>tag_id)" does not exist`, verified live).
  // Hence the explicit select-then-update-or-insert.
  const now = new Date().toISOString();
  const { data: existingSs } = await supabase
    .from('shared_sets')
    .select('id')
    .eq('owner_id', userId)
    .eq('kind', 'compilation')
    .eq('ref->>tag_id', rootTag.id)
    .maybeSingle();

  let sharedSetId = (existingSs as { id: string } | null)?.id ?? null;
  if (sharedSetId) {
    await supabase.from('shared_sets').update({
      title: rootTag.name, payload: tags, item_count: selectionCount, updated_at: now,
    }).eq('id', sharedSetId);
  } else {
    const { data: inserted, error: insErr } = await supabase.from('shared_sets').insert({
      owner_id: userId, kind: 'compilation', title: rootTag.name,
      ref: { tag_id: rootTag.id }, payload: tags, item_count: selectionCount, updated_at: now,
    }).select('id').maybeSingle();
    sharedSetId = (inserted as { id: string } | null)?.id ?? null;
    if (!sharedSetId) {
      // A concurrent publishTag won the race and inserted first (unique-violation
      // on shared_sets_compilation_uniq), or the row otherwise exists now.
      // Re-read so the community_tags FK below still gets set. If even this
      // fails, leave the FK null — the next publishTag / refreshSharedCompilation
      // heals it.
      if (insErr && insErr.code !== '23505') console.warn('[publishTag] shared_sets insert:', insErr.message);
      const { data: reread } = await supabase.from('shared_sets')
        .select('id')
        .eq('owner_id', userId).eq('kind', 'compilation').eq('ref->>tag_id', rootTag.id)
        .maybeSingle();
      sharedSetId = (reread as { id: string } | null)?.id ?? null;
    }
  }

  if (sharedSetId) {
    await supabase.from('community_tags')
      .update({ shared_set_id: sharedSetId })
      .eq('user_id', userId).eq('tag_id', rootTag.id);
  }

  return { droppedImported };
}

/**
 * Remove a tag from the community feed. Subscribers keep their local copies.
 * Mirrors mobile unpublishTag.
 */
export async function unpublishTag(rootTagId: string, userId: string): Promise<void> {
  const supabase = createClient();
  const { error } = await supabase
    .from('community_tags')
    .delete()
    .eq('user_id', userId)
    .eq('tag_id', rootTagId);
  if (error) throw error;
}

// ─── Import ───────────────────────────────────────────────────────────────────

/**
 * Resolve payload pids to Supabase passage uuids.
 *
 * A payload carries the portable pid ("efb81dbb4653"), but `selections.passage_id`
 * is a uuid FK into `passages` — writing the pid there is rejected by Postgres,
 * and supabase-js reports that in `error` rather than throwing, so an import that
 * gets this wrong silently produces a tag with no quotes in it.
 */
export async function resolvePassageIds(
  supabase: ReturnType<typeof createClient>,
  pids: string[],
): Promise<Record<string, string>> {
  const map: Record<string, string> = {};
  const unique = [...new Set(pids.filter(Boolean))];
  const CHUNK = 200;   // keep the `in` list well inside PostgREST's URL limit
  for (let i = 0; i < unique.length; i += CHUNK) {
    const { data } = await supabase
      .from('passage_pid_map')
      .select('pid, passage_id')
      .in('pid', unique.slice(i, i + CHUNK));
    for (const r of (data ?? []) as { pid: string; passage_id: string }[]) {
      map[r.pid] = r.passage_id;
    }
  }
  return map;
}

/** Build the selections rows for one payload tag, skipping unresolvable pids. */
function selectionRowsFor(
  tagExport: ImmTagExport,
  userId: string,
  pidMap: Record<string, string>,
  now: string,
) {
  const rows: Record<string, unknown>[] = [];
  for (const sel of tagExport.selections) {
    if (sel.importedReadOnly) continue;   // sharer's imported-book quote — display-only, never copied
    const passageId = pidMap[sel.startPid];
    if (!passageId) {
      console.warn('[communitySync] Skipping selection — unknown passage:', sel.startPid);
      continue;
    }
    rows.push({
      id:                    crypto.randomUUID(),
      user_id:               userId,
      passage_id:            passageId,
      start_pid:             sel.startPid,
      end_pid:               sel.endPid ?? sel.startPid,
      book_local_id:         sel.bookId ?? null,
      anchor_schema_version: 1,
      start_offset:          sel.startOffset,
      end_offset:            sel.endOffset,
      snapshot_text:         sel.snapshotText,
      created_at:            sel.createdAt,
      updated_at:            now,
    });
  }
  return rows;
}

/**
 * Write a community payload as a fresh local tag subtree for `userId`.
 * Returns the new root local tag id. Does NOT record a subscription or a copy —
 * the caller decides which (importCommunityTag → subscription, copyCommunityTag → copy).
 */
export async function writeLocalTagTree(
  supabase: ReturnType<typeof createClient>,
  payload: ImmTagExport[],
  userId: string,
  visibility: 'imported' | 'private',
): Promise<string> {
  const now    = new Date().toISOString();
  const idMap: Record<string, string> = {};
  let rootLocalTagId = '';
  const sorted = [...payload].sort((a, b) => a.depth - b.depth);
  const pidMap = await resolvePassageIds(supabase, sorted.flatMap(t => (t.selections ?? []).map(s => s.startPid)));

  for (const tagExport of sorted) {
    const newTagId = crypto.randomUUID();
    idMap[tagExport.exportId] = newTagId;
    if (tagExport.depth === 0) rootLocalTagId = newTagId;

    const { error: tagErr } = await supabase.from('tags').insert({
      id: newTagId, user_id: userId,
      parent_id: tagExport.parentExportId ? (idMap[tagExport.parentExportId] ?? null) : null,
      name: tagExport.name, depth: tagExport.depth, sort_order: tagExport.sortOrder,
      visibility, created_at: now,
    });
    if (tagErr) throw tagErr;

    const selRows = selectionRowsFor(tagExport, userId, pidMap, now);
    if (selRows.length === 0) continue;
    const { error: selErr } = await supabase.from('selections').insert(selRows);
    if (selErr) throw selErr;
    const { error: linkErr } = await supabase.from('selection_tags').insert(
      selRows.map(r => ({ selection_id: r.id as string, tag_id: newTagId, created_at: now })),
    );
    if (linkErr) throw linkErr;
  }
  return rootLocalTagId;
}

/**
 * Import a community tag into the user's library and subscribe to updates.
 * Returns the local root tag ID.
 *
 * Idempotent: a second import of the same community tag returns the root that
 * already exists instead of building a second copy of the whole tree. Repeated
 * taps on Import used to leave a user with three identical tag trees.
 */
export async function importCommunityTag(ct: CommunityTagRow, userId: string): Promise<string> {
  const supabase = createClient();

  // Already subscribed, and the root tag still exists? Nothing to import.
  const { data: existingSub } = await supabase
    .from('community_tag_subscriptions')
    .select('local_tag_id')
    .eq('subscriber_id', userId)
    .eq('community_tag_id', ct.id)
    .maybeSingle();

  if (existingSub?.local_tag_id) {
    const { data: rootStillThere } = await supabase
      .from('tags')
      .select('id')
      .eq('id', existingSub.local_tag_id as string)
      .maybeSingle();
    if (rootStillThere) return existingSub.local_tag_id as string;
  }

  if (isViewOnlyPayload(ct.payload)) throw new ViewOnlyShareError();

  const rootLocalTagId = await writeLocalTagTree(supabase, ct.payload, userId, 'imported');

  const { error: subErr } = await supabase.from('community_tag_subscriptions').upsert(
    {
      subscriber_id:          userId,
      community_tag_id:       ct.id,
      local_tag_id:           rootLocalTagId,
      last_synced_updated_at: ct.updated_at,
    },
    { onConflict: 'subscriber_id,community_tag_id' },
  );
  if (subErr) throw subErr;

  return rootLocalTagId;
}

// ─── Subscriber sync ──────────────────────────────────────────────────────────

/**
 * Sync all subscribed community tags for a user.
 * Silently adds new selections and creates any new subtags added by the publisher.
 * Called on app load and Community tab focus.
 */
export async function syncSubscribedTags(userId: string): Promise<void> {
  const supabase = createClient();
  const now      = new Date().toISOString();

  const { data: subs } = await supabase
    .from('community_tag_subscriptions')
    .select('id, community_tag_id, local_tag_id, last_synced_updated_at')
    .eq('subscriber_id', userId);

  if (!subs || subs.length === 0) return;

  const { data: allLocalTagsData } = await supabase
    .from('tags')
    .select('id, name, parent_id')
    .eq('user_id', userId);

  const allLocalTags = (allLocalTagsData ?? []) as LocalTag[];

  for (const sub of subs) {
    try {
      const { data: ct } = await supabase
        .from('community_tags')
        .select('id, payload, updated_at')
        .eq('id', sub.community_tag_id)
        .single();

      if (!ct) continue;

      const lastSynced = (sub.last_synced_updated_at as string | null) ?? '1970-01-01T00:00:00Z';
      if (ct.updated_at <= lastSynced) continue;

      const tagIdMap = buildTagIdMap(ct.payload as ImmTagExport[], sub.local_tag_id as string, allLocalTags);

      // Sort parents before children so newly-created parent IDs are in tagIdMap
      // before we reach their children.
      const sortedPayload = [...ct.payload as ImmTagExport[]].sort((a, b) => a.depth - b.depth);

      for (const tagExport of sortedPayload) {
        let localTagId = tagIdMap.get(tagExport.exportId);

        if (!localTagId) {
          // Root missing means the subscription is broken — skip.
          if (tagExport.depth === 0) continue;

          // New subtag added by publisher — create it locally now.
          const localParentId = tagExport.parentExportId
            ? tagIdMap.get(tagExport.parentExportId)
            : null;
          if (!localParentId) continue;

          const newTagId = crypto.randomUUID();
          try {
            await supabase.from('tags').insert({
              id:         newTagId,
              user_id:    userId,
              parent_id:  localParentId,
              name:       tagExport.name,
              depth:      tagExport.depth,
              sort_order: tagExport.sortOrder,
              visibility: 'imported',
              created_at: now,
            });
          } catch (e) {
            console.warn('[communitySync] Failed to create new subtag:', tagExport.name, e);
            continue;
          }
          allLocalTags.push({ id: newTagId, name: tagExport.name, parent_id: localParentId });
          tagIdMap.set(tagExport.exportId, newTagId);
          localTagId = newTagId;
        }

        // Fingerprint existing selections for this tag to avoid duplicates.
        // Fingerprints are keyed on start_pid — the payload speaks pids, and
        // passage_id is only resolvable for passages this catalogue carries.
        const { data: existingSTs } = await supabase
          .from('selection_tags')
          .select('selection_id')
          .eq('tag_id', localTagId);

        const existingSelIds = (existingSTs ?? []).map((st: { selection_id: string }) => st.selection_id);
        const existingFp = new Set<string>();

        if (existingSelIds.length > 0) {
          const { data: existingSels } = await supabase
            .from('selections')
            .select('start_pid, start_offset')
            .in('id', existingSelIds);
          for (const s of (existingSels ?? []) as { start_pid: string; start_offset: number }[]) {
            existingFp.add(`${s.start_pid}::${s.start_offset}`);
          }
        }

        const fresh = {
          ...tagExport,
          selections: tagExport.selections.filter(
            sel => !existingFp.has(`${sel.startPid}::${sel.startOffset}`),
          ),
        };
        if (fresh.selections.length === 0) continue;

        const pidMap  = await resolvePassageIds(supabase, fresh.selections.map(s => s.startPid));
        const selRows = selectionRowsFor(fresh, userId, pidMap, now);
        if (selRows.length === 0) continue;

        const { error: selErr } = await supabase.from('selections').insert(selRows);
        if (selErr) { console.warn('[communitySync] Sync insert error:', selErr); continue; }

        const { error: linkErr } = await supabase.from('selection_tags').insert(
          selRows.map(r => ({ selection_id: r.id as string, tag_id: localTagId, created_at: now })),
        );
        if (linkErr) console.warn('[communitySync] Sync link error:', linkErr);
      }

      await supabase
        .from('community_tag_subscriptions')
        .update({ last_synced_updated_at: ct.updated_at })
        .eq('id', sub.id);

    } catch (e) {
      console.warn('[communitySync] Error syncing subscription', (sub as { id: string }).id, e);
    }
  }
}

// ─── User follows ─────────────────────────────────────────────────────────────

/**
 * Follow a user: record the follow row, then immediately import all their
 * current public tags that the subscriber doesn't already have.
 */
export async function followUser(subscriberId: string, followedUserId: string): Promise<void> {
  const supabase = createClient();

  const { error } = await supabase
    .from('community_user_follows')
    .upsert(
      { subscriber_id: subscriberId, followed_user_id: followedUserId },
      { onConflict: 'subscriber_id,followed_user_id' },
    );
  if (error) throw error;

  const [{ data: tags }, { data: subs }] = await Promise.all([
    supabase.from('community_tags').select(COMMUNITY_TAG_FIELDS).eq('user_id', followedUserId).eq('listed', true),
    supabase.from('community_tag_subscriptions').select('community_tag_id').eq('subscriber_id', subscriberId),
  ]);

  const subscribedIds = new Set((subs ?? []).map((s: { community_tag_id: string }) => s.community_tag_id));
  for (const tag of (tags ?? []) as CommunityTagRow[]) {
    if (!subscribedIds.has(tag.id)) {
      await importCommunityTag(tag, subscriberId).catch(e =>
        console.warn('[communitySync] followUser import error:', e),
      );
    }
  }
}

/**
 * Unfollow a user. Already-imported tags are kept.
 */
export async function unfollowUser(subscriberId: string, followedUserId: string): Promise<void> {
  const supabase = createClient();
  const { error } = await supabase
    .from('community_user_follows')
    .delete()
    .eq('subscriber_id', subscriberId)
    .eq('followed_user_id', followedUserId);
  if (error) throw error;
}

/**
 * Auto-import any new public tags from followed users that haven't been
 * imported yet. Called on app load and Community tab focus.
 */
export async function syncFollowedUsers(userId: string): Promise<void> {
  const supabase = createClient();

  const { data: follows } = await supabase
    .from('community_user_follows')
    .select('followed_user_id')
    .eq('subscriber_id', userId);

  if (!follows || follows.length === 0) return;

  const { data: subs } = await supabase
    .from('community_tag_subscriptions')
    .select('community_tag_id')
    .eq('subscriber_id', userId);

  const subscribedIds = new Set((subs ?? []).map((s: { community_tag_id: string }) => s.community_tag_id));

  for (const { followed_user_id } of (follows as { followed_user_id: string }[])) {
    const { data: tags } = await supabase
      .from('community_tags')
      .select(COMMUNITY_TAG_FIELDS)
      .eq('user_id', followed_user_id)
      .eq('listed', true);

    for (const tag of (tags ?? []) as CommunityTagRow[]) {
      if (!subscribedIds.has(tag.id)) {
        try {
          await importCommunityTag(tag, userId);
          subscribedIds.add(tag.id);
        } catch (e) {
          console.warn('[communitySync] syncFollowedUsers import error:', e);
        }
      }
    }
  }
}
