'use client';

import { createClient } from '@/lib/supabase/client';
import { buildCitation } from '@/lib/citationUtils';

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

type TagSubtreeRow = { id: string; parent_id: string | null };

/** Collect a tag's id plus all descendant ids from a flat parent_id list (BFS). */
function getSubtreeIds(rootId: string, allTags: TagSubtreeRow[]): string[] {
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
 * xref citations — exactly like mobile buildImmPayload. Selections whose book is
 * user-imported are stripped (privacy: imported books never reach the community).
 */
async function buildCommunityPayload(
  subtreeTagIds: string[],
  userId: string,
): Promise<{ tags: PublishTagExport[]; selectionCount: number }> {
  const supabase = createClient();

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

  for (const tag of orderedTags) {
    type RawSel = PublishSelection & { _note: string | null };
    const rawSels: RawSel[] = [];

    for (const selId of (selIdsByTag.get(tag.id) ?? [])) {
      const sel = selMap[selId];
      if (!sel) continue;
      const passage = sel.passage_id ? passMap[sel.passage_id] : null;
      const book    = passage ? bookMap[passage.book_id] : null;
      if (book?.is_user_imported) continue;   // privacy: imported books stay local

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
        bookTitle:     book?.title ?? sel.book_local_id ?? '',
        citation:      rawCitation(passage, book),
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
      const notes = group.map(s => s._note).filter((n): n is string => n !== null);
      const xrefSet = new Set<string>();
      for (const s of group) s.xrefCitations.forEach(xc => xrefSet.add(xc));

      selExports.push({
        snapshotText:  primary.snapshotText,
        bookId:        primary.bookId,
        bookTitle:     primary.bookTitle,
        citation:      primary.citation,
        notes,
        xrefCitations: [...xrefSet],
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

  return { tags: tagExports, selectionCount };
}

/**
 * Push a tag + its full subtree to the community (idempotent upsert).
 * Mirrors mobile publishTag.
 */
export async function publishTag(rootTag: { id: string; name: string }, userId: string): Promise<void> {
  const supabase = createClient();
  const { data: allTagsData } = await supabase
    .from('tags')
    .select('id, parent_id')
    .eq('user_id', userId);
  const subtreeIds = getSubtreeIds(rootTag.id, (allTagsData ?? []) as TagSubtreeRow[]);

  const { tags, selectionCount } = await buildCommunityPayload(subtreeIds, userId);

  const { error } = await supabase
    .from('community_tags')
    .upsert(
      {
        user_id:         userId,
        tag_id:          rootTag.id,
        name:            rootTag.name,
        payload:         tags,
        selection_count: selectionCount,
        updated_at:      new Date().toISOString(),
      },
      { onConflict: 'user_id,tag_id' },
    );
  if (error) throw error;
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
 * Import a community tag into the user's local library and subscribe to updates.
 * Returns the new local root tag ID.
 */
export async function importCommunityTag(ct: CommunityTagRow, userId: string): Promise<string> {
  const supabase = createClient();
  const now      = new Date().toISOString();
  const idMap: Record<string, string> = {};
  let   rootLocalTagId = '';

  // Parents before children
  const sorted = [...ct.payload].sort((a, b) => a.depth - b.depth);

  for (const tagExport of sorted) {
    const newTagId = crypto.randomUUID();
    idMap[tagExport.exportId] = newTagId;
    if (tagExport.depth === 0) rootLocalTagId = newTagId;

    await supabase.from('tags').insert({
      id:         newTagId,
      user_id:    userId,
      parent_id:  tagExport.parentExportId ? (idMap[tagExport.parentExportId] ?? null) : null,
      name:       tagExport.name,
      depth:      tagExport.depth,
      sort_order: tagExport.sortOrder,
      created_at: now,
    });

    for (const sel of tagExport.selections) {
      const selId = crypto.randomUUID();
      try {
        await supabase.from('selections').insert({
          id:            selId,
          user_id:       userId,
          passage_id:    sel.startPid,
          start_offset:  sel.startOffset,
          end_offset:    sel.endOffset,
          snapshot_text: sel.snapshotText,
          created_at:    sel.createdAt,
        });
        await supabase.from('selection_tags').insert({
          selection_id: selId,
          tag_id:       newTagId,
          created_at:   now,
        });
      } catch (e) {
        console.warn('[communitySync] Skipping selection:', sel.startPid, e);
      }
    }
  }

  await supabase.from('community_tag_subscriptions').upsert(
    {
      subscriber_id:          userId,
      community_tag_id:       ct.id,
      local_tag_id:           rootLocalTagId,
      last_synced_updated_at: ct.updated_at,
    },
    { onConflict: 'subscriber_id,community_tag_id' },
  );

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

        // Fingerprint existing selections for this tag to avoid duplicates
        const { data: existingSTs } = await supabase
          .from('selection_tags')
          .select('selection_id')
          .eq('tag_id', localTagId);

        const existingSelIds = (existingSTs ?? []).map((st: { selection_id: string }) => st.selection_id);
        const existingFp = new Set<string>();

        if (existingSelIds.length > 0) {
          const { data: existingSels } = await supabase
            .from('selections')
            .select('passage_id, start_offset')
            .in('id', existingSelIds);
          for (const s of (existingSels ?? []) as { passage_id: string; start_offset: number }[]) {
            existingFp.add(`${s.passage_id}::${s.start_offset}`);
          }
        }

        for (const sel of tagExport.selections) {
          if (existingFp.has(`${sel.startPid}::${sel.startOffset}`)) continue;

          const selId = crypto.randomUUID();
          try {
            await supabase.from('selections').insert({
              id:            selId,
              user_id:       userId,
              passage_id:    sel.startPid,
              start_offset:  sel.startOffset,
              end_offset:    sel.endOffset,
              snapshot_text: sel.snapshotText,
              created_at:    sel.createdAt,
            });
            await supabase.from('selection_tags').insert({
              selection_id: selId,
              tag_id:       localTagId,
              created_at:   now,
            });
          } catch (e) {
            console.warn('[communitySync] Sync insert error:', e);
          }
        }
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
    supabase.from('community_tags').select(COMMUNITY_TAG_FIELDS).eq('user_id', followedUserId),
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
      .eq('user_id', followed_user_id);

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
