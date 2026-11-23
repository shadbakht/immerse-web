/**
 * Discover moderation (2026-11-23, Apple guideline 1.2 for user-generated content):
 * report a user / compilation / X-Ref, block a user, the word filter, and the one-time
 * community rules. Mirrors Immerse/src/utils/moderation.ts (mobile); change both.
 *
 * The word list is server-side only (public.objectionable_terms; owner-approved list in
 * Immerse/docs/moderation-blocklist.md). Triggers on community_tags / community_xrefs /
 * profiles refuse a blocked word for every client; `containsObjectionable` only lets the
 * UI say so first. Supabase migration 20261123120000_discover_moderation.sql.
 */
import { createClient } from '@/lib/supabase/client';

export type ReportKind = 'user' | 'compilation' | 'xref';
export type ReportReason = 'offensive' | 'harassment' | 'spam' | 'image' | 'other';
export const REPORT_REASONS: ReportReason[] = ['offensive', 'harassment', 'spam', 'image', 'other'];

/** True when the server would refuse this text. A failed check answers false: the trigger still decides. */
export async function containsObjectionable(...texts: (string | null | undefined)[]): Promise<boolean> {
  const supabase = createClient();
  for (const text of texts) {
    if (!text || !text.trim()) continue;
    const { data, error } = await supabase.rpc('contains_objectionable', { t: text });
    if (!error && data === true) return true;
  }
  return false;
}

/** The error a guard trigger raises for a blocked word. */
export function isObjectionableError(e: unknown): boolean {
  const err = e as { message?: string; hint?: string } | null;
  return err?.message === 'objectionable_content' || err?.hint === 'moderation.objectionable';
}

export async function reportContent(args: {
  kind: ReportKind; targetId: string; targetUserId?: string | null; reason: ReportReason; reporterId?: string | null;
}): Promise<void> {
  const { error } = await createClient().from('content_reports').insert({
    reporter_id:    args.reporterId ?? null,
    target_kind:    args.kind,
    target_id:      args.targetId,
    target_user_id: args.targetUserId ?? null,
    reason:         args.reason,
    platform:       'web',
  });
  if (error) throw error;
  // Email the owner (supabase/functions/report-notify). Fire-and-forget: it sends every
  // not-yet-emailed report, so a failed call is picked up by the next report.
  void createClient().functions.invoke('report-notify', { body: {} }).catch(() => {});
}

export async function fetchBlockedIds(userId: string): Promise<Set<string>> {
  const { data, error } = await createClient().from('user_blocks').select('blocked_id').eq('blocker_id', userId);
  if (error) throw error;
  return new Set((data ?? []).map((r: { blocked_id: string }) => r.blocked_id));
}

export async function blockUser(userId: string, blockedId: string): Promise<void> {
  const { error } = await createClient().from('user_blocks')
    .upsert({ blocker_id: userId, blocked_id: blockedId }, { onConflict: 'blocker_id,blocked_id', ignoreDuplicates: true });
  if (error) throw error;
}

export async function unblockUser(userId: string, blockedId: string): Promise<void> {
  const { error } = await createClient().from('user_blocks').delete().eq('blocker_id', userId).eq('blocked_id', blockedId);
  if (error) throw error;
}

export interface BlockedProfile { id: string; username: string | null; full_name: string | null; avatar_url: string | null }

export async function fetchBlockedProfiles(userId: string): Promise<BlockedProfile[]> {
  const ids = [...await fetchBlockedIds(userId)];
  if (!ids.length) return [];
  const { data, error } = await createClient().from('profiles').select('id, username, full_name, avatar_url').in('id', ids);
  if (error) throw error;
  const byId = new Map((data ?? []).map((p: BlockedProfile) => [p.id, p]));
  return ids.map(id => byId.get(id) ?? { id, username: null, full_name: null, avatar_url: null });
}

const acceptedThisSession = new Set<string>();

/**
 * Before a user's first publish: show the community rules once and record the agreement
 * (profiles.community_terms_accepted_at). `confirmRules` shows the text and resolves with
 * the answer. A failed read lets the publish go ahead — the word filter is server-side.
 */
export async function ensureCommunityRules(userId: string, confirmRules: () => Promise<boolean>): Promise<boolean> {
  if (acceptedThisSession.has(userId)) return true;
  const supabase = createClient();
  const { data, error } = await supabase.from('profiles')
    .select('community_terms_accepted_at').eq('id', userId).maybeSingle();
  if (error) return true;
  if ((data as { community_terms_accepted_at?: string | null } | null)?.community_terms_accepted_at) {
    acceptedThisSession.add(userId);
    return true;
  }
  if (!(await confirmRules())) return false;
  acceptedThisSession.add(userId);
  await supabase.from('profiles').update({ community_terms_accepted_at: new Date().toISOString() }).eq('id', userId);
  return true;
}
