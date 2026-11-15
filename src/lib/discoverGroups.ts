/**
 * Discover groups the feed by PUBLISHER (2026-11-14, owner's layout): each user
 * is a top-level row, their public compilations then public X-Refs underneath.
 *
 * Pure — no React, no Supabase. The same file lives at
 * Immerse/src/utils/discoverGroups.ts (mobile); change both.
 */

export type DiscoverMode = 'trending' | 'recent';

export interface DiscoverProfile {
  full_name?: string | null;
  username?:  string | null;
  avatar_url?: string | null;
}

/** The fields grouping needs from a community_tags / community_xrefs row. */
export interface DiscoverItemBase {
  id:           string;
  user_id:      string;
  import_count: number;
  published_at: string;
  updated_at?:  string;
  profiles?:    DiscoverProfile | null;
}

export interface DiscoverGroup<C extends DiscoverItemBase, X extends DiscoverItemBase> {
  userId:       string;
  profile:      DiscoverProfile | null;
  compilations: C[];
  xrefs:        X[];
  importTotal:  number;
  latestAt:     string;
  /** Items whose own text matched the search — opened automatically. */
  matchedIds:   Set<string>;
  /** True when the search matched an item (not just the user's name), so the
   *  user row opens automatically too. */
  openForSearch: boolean;
}

const byMode = (mode: DiscoverMode) => (a: DiscoverItemBase, b: DiscoverItemBase) =>
  mode === 'trending'
    ? (b.import_count - a.import_count) || b.published_at.localeCompare(a.published_at)
    : b.published_at.localeCompare(a.published_at);

/**
 * @param compilationText text a compilation is searched by (its name)
 * @param xrefText        text an X-Ref is searched by (label + both quotes)
 */
export function groupDiscoverFeed<C extends DiscoverItemBase, X extends DiscoverItemBase>(
  compilations: C[],
  xrefs: X[],
  opts: {
    mode: DiscoverMode;
    query?: string;
    compilationText: (c: C) => string;
    xrefText: (x: X) => string;
  },
): DiscoverGroup<C, X>[] {
  const q = (opts.query ?? '').trim().toLowerCase();
  const map = new Map<string, DiscoverGroup<C, X>>();
  const groupFor = (it: DiscoverItemBase) => {
    let g = map.get(it.user_id);
    if (!g) {
      g = { userId: it.user_id, profile: it.profiles ?? null, compilations: [], xrefs: [],
        importTotal: 0, latestAt: '', matchedIds: new Set(), openForSearch: false };
      map.set(it.user_id, g);
    }
    if (!g.profile && it.profiles) g.profile = it.profiles;
    g.importTotal += it.import_count ?? 0;
    if (it.published_at > g.latestAt) g.latestAt = it.published_at;
    return g;
  };
  for (const c of compilations) groupFor(c).compilations.push(c);
  for (const x of xrefs) groupFor(x).xrefs.push(x);

  const cmp = byMode(opts.mode);
  let groups = [...map.values()];
  for (const g of groups) { g.compilations.sort(cmp); g.xrefs.sort(cmp); }

  if (q) {
    groups = groups.filter(g => {
      const userHit = [g.profile?.full_name, g.profile?.username]
        .some(s => (s ?? '').toLowerCase().includes(q));
      for (const c of g.compilations) if (opts.compilationText(c).toLowerCase().includes(q)) g.matchedIds.add(c.id);
      for (const x of g.xrefs) if (opts.xrefText(x).toLowerCase().includes(q)) g.matchedIds.add(x.id);
      g.openForSearch = g.matchedIds.size > 0;
      return userHit || g.openForSearch;
    });
  }

  return groups.sort((a, b) =>
    opts.mode === 'trending'
      ? (b.importTotal - a.importTotal) || b.latestAt.localeCompare(a.latestAt)
      : b.latestAt.localeCompare(a.latestAt));
}

/** Initials for an avatar with no photo: "Rooz Manshadi" → "RM", "rooz" → "R". */
export function initialsFor(fullName?: string | null, username?: string | null): string {
  const words = (fullName ?? '').trim().split(/\s+/).filter(Boolean);
  if (words.length >= 2) return (Array.from(words[0])[0] + Array.from(words[words.length - 1])[0]).toUpperCase();
  const one = words[0] ?? (username ?? '').trim();
  return (Array.from(one)[0] ?? '?').toUpperCase();
}
