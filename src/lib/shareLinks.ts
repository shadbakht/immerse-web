'use client';

import { createClient } from '@/lib/supabase/client';
import { publishTag, writeLocalTagTree, type CommunityTagRow } from './communitySync';
import { shareUrl } from './shareUrl';

export { shareUrl };

export interface ShareState { id: string; listed: boolean }

export function decideShareUpsert(
  existing: ShareState | null,
): { action: 'insert' | 'none'; listed: boolean } {
  if (!existing) return { action: 'insert', listed: false };
  return { action: 'none', listed: existing.listed };
}

async function getSubtreeRootRow(supabase: ReturnType<typeof createClient>, userId: string, tagId: string) {
  const { data } = await supabase
    .from('community_tags')
    .select('id, listed')
    .eq('user_id', userId)
    .eq('tag_id', tagId)
    .maybeSingle();
  return (data as { id: string; listed: boolean } | null) ?? null;
}

export async function getShareState(userId: string, tagId: string): Promise<ShareState | null> {
  const supabase = createClient();
  return getSubtreeRootRow(supabase, userId, tagId);
}

/** Create (or return) the unlisted share row for a compilation. Never downgrades a listed row. */
export async function createShareLink(
  rootTag: { id: string; name: string },
  userId: string,
): Promise<{ id: string; url: string; listed: boolean }> {
  const supabase = createClient();
  const existing = await getSubtreeRootRow(supabase, userId, rootTag.id);
  const decision = decideShareUpsert(existing);

  if (decision.action === 'insert') {
    await publishTag(rootTag, userId, { listed: false });
    const row = await getSubtreeRootRow(supabase, userId, rootTag.id);
    if (!row) throw new Error('share row not created');
    logShareCreated(supabase, row.id);
    return { id: row.id, url: shareUrl(row.id), listed: false };
  }
  return { id: existing!.id, url: shareUrl(existing!.id), listed: existing!.listed };
}

/** Revoke a share link. Only deletes an UNLISTED row — a listed (Discover) row is left alone. */
export async function revokeShareLink(rootTagId: string, userId: string): Promise<void> {
  const supabase = createClient();
  const row = await getSubtreeRootRow(supabase, userId, rootTagId);
  if (!row || row.listed) return;
  const { error } = await supabase
    .from('community_tags').delete().eq('user_id', userId).eq('tag_id', rootTagId).eq('listed', false);
  if (error) throw error;
}

/** One-time copy of a shared compilation into the current user's own Compilations (no subscription). */
export async function copyCommunityTag(communityTagId: string, userId: string): Promise<string> {
  const supabase = createClient();

  const { data: existingCopy } = await supabase
    .from('community_tag_copies').select('local_tag_id')
    .eq('subscriber_id', userId).eq('community_tag_id', communityTagId).maybeSingle();
  if (existingCopy?.local_tag_id) {
    const { data: stillThere } = await supabase
      .from('tags').select('id').eq('id', existingCopy.local_tag_id as string).maybeSingle();
    if (stillThere) return existingCopy.local_tag_id as string;
  }

  const { data: ct } = await supabase
    .from('community_tags').select('id, payload, updated_at').eq('id', communityTagId).maybeSingle();
  if (!ct) throw new Error('shared compilation not found');

  const rootLocalTagId = await writeLocalTagTree(supabase, (ct as CommunityTagRow).payload, userId, 'private');

  await supabase.from('community_tag_copies').upsert(
    { subscriber_id: userId, community_tag_id: communityTagId, local_tag_id: rootLocalTagId },
    { onConflict: 'subscriber_id,community_tag_id' },
  );
  return rootLocalTagId;
}

function logShareCreated(supabase: ReturnType<typeof createClient>, compilationId: string) {
  void supabase.from('analytics_events').insert({
    event_type: 'share_link_created', properties: { compilation_id: compilationId }, platform: 'web',
  }).then(() => {}, () => {});
}
