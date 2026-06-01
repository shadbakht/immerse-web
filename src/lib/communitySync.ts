'use client';

import { createClient } from '@/lib/supabase/client';

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
