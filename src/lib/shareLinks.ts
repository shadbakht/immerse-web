'use client';

import { createClient } from '@/lib/supabase/client';
import { shareUrl } from './shareUrl';
import { copySharedCompilation, ensureCompilationShare } from './sharedSets';

export { shareUrl };

export interface ShareState { id: string; listed: boolean }

/**
 * Read a compilation's share state from `shared_sets` (Phase 8).
 *
 * `listed` = "is this compilation in the Discover feed" — now derived from
 * whether a `community_tags` row exists, NOT from a column on the share row.
 * A link-only share is a `shared_sets` row with no `community_tags` row.
 */
async function readState(
  supabase: ReturnType<typeof createClient>,
  userId: string,
  tagId: string,
): Promise<ShareState | null> {
  const { data: ss } = await supabase
    .from('shared_sets').select('id')
    .eq('owner_id', userId).eq('kind', 'compilation').eq('ref->>tag_id', tagId).maybeSingle();
  if (!ss) return null;
  const { data: ct } = await supabase
    .from('community_tags').select('id').eq('user_id', userId).eq('tag_id', tagId).maybeSingle();
  return { id: (ss as { id: string }).id, listed: !!ct };
}

export function decideShareUpsert(
  existing: ShareState | null,
): { action: 'insert' | 'none'; listed: boolean } {
  if (!existing) return { action: 'insert', listed: false };
  return { action: 'none', listed: existing.listed };
}

export async function getShareState(userId: string, tagId: string): Promise<ShareState | null> {
  return readState(createClient(), userId, tagId);
}

/** Create (or return) the share row for a compilation. Never publishes to Discover. */
export async function createShareLink(
  rootTag: { id: string; name: string },
  userId: string,
): Promise<{ id: string; url: string; listed: boolean }> {
  const supabase = createClient();
  const existing = await readState(supabase, userId, rootTag.id);
  if (existing) return { id: existing.id, url: shareUrl(existing.id), listed: existing.listed };

  // Link-only compilation share: a shared_sets row, NO community_tags row.
  const { id } = await ensureCompilationShare(supabase, rootTag, userId);
  logShareCreated(supabase, id);
  return { id, url: shareUrl(id), listed: false };
}

/**
 * Revoke a compilation's share link. A Discover-listed compilation is retired via
 * Unpublish (which deletes the community_tags row and keeps the link), never here —
 * so no code path deletes a shared_sets row a community_tags row still references.
 */
export async function revokeShareLink(rootTagId: string, userId: string): Promise<void> {
  const supabase = createClient();
  const state = await readState(supabase, userId, rootTagId);
  if (!state || state.listed) return;
  const { error } = await supabase
    .from('shared_sets').delete()
    .eq('owner_id', userId).eq('kind', 'compilation').eq('ref->>tag_id', rootTagId);
  if (error) throw error;
}

// Kept as an alias so existing imports (SaveOnLoad) don't break.
export { copySharedCompilation as copyCommunityTag };

function logShareCreated(supabase: ReturnType<typeof createClient>, sharedSetId: string) {
  void supabase.from('analytics_events').insert({
    event_type: 'share_link_created',
    properties: { shared_set_id: sharedSetId, kind: 'compilation' },
    platform: 'web',
  }).then(() => {}, () => {});
}
