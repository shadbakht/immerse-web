import type { SupabaseClient } from '@supabase/supabase-js';

/**
 * Which Library books wear a "New" pill: those added to a language's library
 * in the last RECENT_DAYS, not counting the language's own launch week.
 *
 * A book's add date is Supabase's `books.created_at`, when it first reached
 * the shared catalogue; it matches the release history (the seven Arabic
 * hadith books on 2026-10-16, Zhuangzi on 2026-09-09). Neither the corpus nor
 * the packs carry it, so both apps ask Supabase. The same logic lives in
 * the mobile app's src/utils/recentlyAdded.ts; keep the two equal.
 */

/** How long a book stays new. */
export const RECENT_DAYS = 30;

/**
 * A language arrives as a batch over its first days (Spanish over July 23 and
 * 26), and none of that is news to someone reading it, so books added within
 * a week of a language's first one are left out.
 */
export const LAUNCH_WINDOW_DAYS = 7;

const DAY_MS = 24 * 60 * 60 * 1000;

export interface RecentBook {
  /** Local book id (the corpus slug). */
  id: string;
  /** When the book was added to the library (ISO timestamp). */
  addedAt: string;
}

/** The earliest add date that still counts as recent. */
export function recentSince(firstAddedAt: string, now: Date): Date {
  return new Date(Math.max(
    now.getTime() - RECENT_DAYS * DAY_MS,
    new Date(firstAddedAt).getTime() + LAUNCH_WINDOW_DAYS * DAY_MS,
  ));
}

/**
 * The new books, newest first: added since `recentSince`, and, when `present`
 * is given, only those this device actually has.
 */
export function pickRecentlyAdded(
  rows: readonly RecentBook[],
  firstAddedAt: string | null,
  now: Date,
  present?: ReadonlySet<string>,
): RecentBook[] {
  if (!firstAddedAt) return [];
  const since = recentSince(firstAddedAt, now).getTime();
  const time = (r: RecentBook) => new Date(r.addedAt).getTime();
  const seen = new Set<string>();
  return rows
    .filter(r => time(r) >= since && (!present || present.has(r.id)))
    .sort((a, b) => time(b) - time(a) || a.id.localeCompare(b.id))
    .filter(r => !seen.has(r.id) && !!seen.add(r.id));
}

export interface RecentlyAddedData {
  /** When the language's first book was added; null if it has none. */
  firstAddedAt: string | null;
  rows: RecentBook[];
}

/** All this needs of the Supabase client, so tests can pass a fake. */
type Client = Pick<SupabaseClient, 'from'>;

/**
 * Two small reads: the language's first add date (which sets where its launch
 * window ends), then every curated book added since `recentSince`, with its
 * local id. Throws on a failed read; callers keep whatever they had.
 */
export async function fetchRecentlyAdded(
  client: Client,
  language: string,
  now: Date = new Date(),
): Promise<RecentlyAddedData> {
  // The library's own books in this language. A signed-in reader can also read
  // their own imported books from this table, which must not count.
  const curated = (columns: string) => client.from('books')
    .select(columns)
    .eq('language', language)
    .eq('is_active', true)
    .eq('is_user_imported', false);

  const first = await curated('created_at')
    .order('created_at', { ascending: true })
    .limit(1)
    .maybeSingle();
  if (first.error) throw first.error;
  // The column list is a plain string here, so supabase-js can't type the
  // rows from it; these are their actual shapes.
  const firstRow = first.data as unknown as { created_at: string } | null;
  if (!firstRow) return { firstAddedAt: null, rows: [] };
  const firstAddedAt = firstRow.created_at;

  const recent = await curated('created_at, book_slug_map(local_id)')
    .gte('created_at', recentSince(firstAddedAt, now).toISOString())
    .order('created_at', { ascending: false });
  if (recent.error) throw recent.error;

  type Row = {
    created_at: string;
    book_slug_map: { local_id: string } | { local_id: string }[] | null;
  };
  const rows: RecentBook[] = [];
  for (const r of (recent.data ?? []) as unknown as Row[]) {
    // book_id is book_slug_map's primary key, so PostgREST embeds one object;
    // accept a list too in case that ever changes.
    const maps = Array.isArray(r.book_slug_map) ? r.book_slug_map : r.book_slug_map ? [r.book_slug_map] : [];
    for (const m of maps) if (m?.local_id) rows.push({ id: m.local_id, addedAt: r.created_at });
  }
  return { firstAddedAt, rows };
}
