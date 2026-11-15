/**
 * communityXrefs.ts — public X-Refs on Discover (2026-11-14).
 *
 * An X-Ref is "public" when a `community_xrefs` row exists for it; the row holds
 * a snapshot of both passages + the label (never notes). Mirrors mobile
 * Immerse/src/utils/communityXrefs.ts — change both. Same payload shape, so an
 * X-Ref published on either platform imports on the other.
 */

import { createClient } from '@/lib/supabase/client';
import { resolvePassageIds } from '@/lib/communitySync';

export interface CommunityXrefSide {
  bookId:       string;   // local book id (catalog slug), as mobile stores it
  bookTitle:    string;
  citation:     string;
  snapshotText: string;
  startPid:     string;
  endPid:       string;
  startOffset:  number;
  endOffset:    number;
}

export interface CommunityXrefRow {
  id:           string;
  user_id:      string;
  xref_id:      string;
  label:        string | null;
  payload:      { a: CommunityXrefSide; b: CommunityXrefSide };
  import_count: number;
  published_at: string;
  updated_at:   string;
  profiles?:    { full_name?: string | null; username: string | null; avatar_url: string | null } | null;
}

export class XrefNotPublishableError extends Error {
  constructor() { super('not publishable'); this.name = 'XrefNotPublishableError'; }
}

/** What the X-Refs screen already knows about each side (for the labels a
 *  selection row doesn't carry). */
export interface XrefDisplay {
  id: string;
  label: string | null;
  selectionAId: string;
  selectionBId: string;
  citationA: string; bookTitleA: string;
  citationB: string; bookTitleB: string;
}

type SelRow = {
  id: string; start_pid: string | null; end_pid: string | null; start_offset: number; end_offset: number;
  snapshot_text: string; book_local_id: string | null; passage_id: string | null;
};

async function buildSnapshot(x: XrefDisplay): Promise<CommunityXrefRow['payload']> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from('selections')
    .select('id, start_pid, end_pid, start_offset, end_offset, snapshot_text, book_local_id, passage_id')
    .in('id', [x.selectionAId, x.selectionBId]);
  if (error) throw error;
  const byId = new Map(((data ?? []) as SelRow[]).map(r => [r.id, r]));
  const a = byId.get(x.selectionAId), b = byId.get(x.selectionBId);
  if (!a || !b || !a.start_pid || !b.start_pid) throw new XrefNotPublishableError();

  // Older web selections carry no book_local_id — derive it from the passage.
  const needSlug = [a, b].filter(s => !s.book_local_id && s.passage_id).map(s => s.passage_id as string);
  const slugByPassage = new Map<string, string>();
  if (needSlug.length) {
    const { data: ps } = await supabase.from('passages').select('id, book_id').in('id', needSlug);
    const bookIds = [...new Set(((ps ?? []) as { id: string; book_id: string }[]).map(p => p.book_id))];
    const { data: sm } = bookIds.length
      ? await supabase.from('book_slug_map').select('book_id, local_id').in('book_id', bookIds)
      : { data: [] };
    const slugByBook = new Map(((sm ?? []) as { book_id: string; local_id: string }[]).map(r => [r.book_id, r.local_id]));
    for (const p of (ps ?? []) as { id: string; book_id: string }[]) {
      const slug = slugByBook.get(p.book_id);
      if (slug) slugByPassage.set(p.id, slug);
    }
  }
  const side = (s: SelRow, citation: string, bookTitle: string): CommunityXrefSide => {
    const bookId = s.book_local_id ?? (s.passage_id ? slugByPassage.get(s.passage_id) : undefined);
    // No catalog slug = a book the user imported themselves: never on Discover.
    if (!bookId) throw new XrefNotPublishableError();
    return {
      bookId, bookTitle, citation, snapshotText: s.snapshot_text,
      startPid: s.start_pid as string, endPid: s.end_pid ?? (s.start_pid as string),
      startOffset: s.start_offset ?? 0, endOffset: s.end_offset ?? 0,
    };
  };
  return { a: side(a, x.citationA, x.bookTitleA), b: side(b, x.citationB, x.bookTitleB) };
}

export async function publishXref(x: XrefDisplay, userId: string): Promise<void> {
  const supabase = createClient();
  const payload = await buildSnapshot(x);
  const { error } = await supabase.from('community_xrefs').upsert(
    { user_id: userId, xref_id: x.id, label: x.label, payload, listed: true, updated_at: new Date().toISOString() },
    { onConflict: 'user_id,xref_id' },
  );
  if (error) throw error;
}

export async function unpublishXref(xrefId: string, userId: string): Promise<void> {
  const supabase = createClient();
  const { error } = await supabase.from('community_xrefs').delete().eq('user_id', userId).eq('xref_id', xrefId);
  if (error) throw error;
}

export async function fetchPublicXrefIds(userId: string): Promise<Set<string>> {
  const supabase = createClient();
  const { data, error } = await supabase.from('community_xrefs').select('xref_id').eq('user_id', userId);
  if (error) throw error;
  return new Set((data ?? []).map((r: { xref_id: string }) => r.xref_id));
}

/** Drop Discover rows whose X-Ref is gone. Only call with a list from a
 *  successful fetch — an errored fetch's [] would unpublish everything. */
export async function pruneOrphanedCommunityXrefs(userId: string, liveXrefIds: string[]): Promise<void> {
  const supabase = createClient();
  const { data, error } = await supabase.from('community_xrefs').select('xref_id').eq('user_id', userId);
  if (error || !data) return;
  const live = new Set(liveXrefIds);
  const orphans = (data as { xref_id: string }[]).map(r => r.xref_id).filter(id => !live.has(id));
  if (orphans.length) await supabase.from('community_xrefs').delete().eq('user_id', userId).in('xref_id', orphans);
}

/** Community X-Ref ids the viewer has imported and still has. */
export async function liveSubscribedXrefIds(userId: string): Promise<Set<string>> {
  const supabase = createClient();
  const { data } = await supabase
    .from('community_xref_subscriptions').select('community_xref_id, local_xref_id').eq('subscriber_id', userId);
  const rows = (data ?? []) as { community_xref_id: string; local_xref_id: string | null }[];
  const localIds = rows.map(r => r.local_xref_id).filter(Boolean) as string[];
  if (!localIds.length) return new Set();
  const { data: live } = await supabase.from('xrefs').select('id').eq('user_id', userId).in('id', localIds);
  const have = new Set(((live ?? []) as { id: string }[]).map(x => x.id));
  return new Set(rows.filter(r => r.local_xref_id && have.has(r.local_xref_id)).map(r => r.community_xref_id));
}

/** Copy a public X-Ref into the viewer's library and record the subscription
 *  (which counts the import). Idempotent while the earlier copy exists. */
export async function importCommunityXref(cx: CommunityXrefRow, userId: string): Promise<string> {
  const supabase = createClient();
  const { data: prior } = await supabase
    .from('community_xref_subscriptions').select('local_xref_id')
    .eq('subscriber_id', userId).eq('community_xref_id', cx.id).maybeSingle();
  if (prior?.local_xref_id) {
    const { data: still } = await supabase.from('xrefs').select('id').eq('id', prior.local_xref_id).maybeSingle();
    if (still) return prior.local_xref_id as string;
  }

  const { a, b } = cx.payload;
  const pidMap = await resolvePassageIds(supabase, [a.startPid, b.startPid]);
  const now = new Date().toISOString();
  const mk = (s: CommunityXrefSide) => ({
    id: crypto.randomUUID(), user_id: userId, book_local_id: s.bookId,
    passage_id: pidMap[s.startPid] ?? null,
    start_pid: s.startPid, end_pid: s.endPid, start_offset: s.startOffset, end_offset: s.endOffset,
    snapshot_text: s.snapshotText, anchor_schema_version: 1, created_at: now, updated_at: now,
  });
  const selA = mk(a), selB = mk(b);
  const { error: se } = await supabase.from('selections').insert([selA, selB]);
  if (se) throw se;
  const [lo, hi] = selA.id < selB.id ? [selA.id, selB.id] : [selB.id, selA.id];
  const xrefId = crypto.randomUUID();
  const { error: xe } = await supabase.from('xrefs').insert({
    id: xrefId, user_id: userId, selection_a_id: lo, selection_b_id: hi, label: cx.label, created_at: now, updated_at: now,
  });
  if (xe) {
    await supabase.from('selections').delete().in('id', [selA.id, selB.id]);
    throw xe;
  }
  const { error } = await supabase.from('community_xref_subscriptions').upsert(
    { subscriber_id: userId, community_xref_id: cx.id, local_xref_id: xrefId },
    { onConflict: 'subscriber_id,community_xref_id' },
  );
  if (error) throw error;
  return xrefId;
}
