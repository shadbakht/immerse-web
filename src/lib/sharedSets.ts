'use client';

import { createClient } from '@/lib/supabase/client';
import { buildCommunityPayload } from './communitySync';

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
