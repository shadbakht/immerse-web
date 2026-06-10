/**
 * Shared catalog helpers for LibraryPanel and HomePanel.
 *
 * catalog.json (75 KB, served from /public) is the source of truth for
 * book titles and category structure — it mirrors the mobile corpus
 * (assets/corpus.bin in the Immerse repo) and is always in sync with the iOS app.
 * Books render in raw array order, so alphabetical sorting lives in the data.
 *
 * book_slug_map (Supabase, 517 rows) bridges corpus slugs ↔ Supabase UUIDs.
 */

export interface CatalogCategory {
  id: string;
  parentId: string | null;
  name: string;
  sortOrder: number;
  kind: 'tradition' | 'collection' | 'imported' | null;
}

export interface CatalogBook {
  id: string;       // corpus slug
  categoryId: string;
  title: string;
}

export interface Catalog {
  version: string;
  categories: CatalogCategory[];
  books: CatalogBook[];
}

// Module-level session cache — shared across all components.
let _catalog: Catalog | null = null;
let _slugToUuid: Map<string, string> | null = null;
let _uuidToSlug: Map<string, string> | null = null;

export async function loadCatalog(): Promise<Catalog> {
  if (!_catalog) {
    const res = await fetch('/catalog.json');
    _catalog = await res.json() as Catalog;
  }
  return _catalog;
}

export async function loadSlugMaps(supabase: ReturnType<typeof import('@/lib/supabase/client').createClient>): Promise<{
  slugToUuid: Map<string, string>;
  uuidToSlug: Map<string, string>;
}> {
  if (!_slugToUuid) {
    const { data } = await supabase.from('book_slug_map').select('local_id, book_id');
    _slugToUuid = new Map((data ?? []).map((r: any) => [r.local_id as string, r.book_id as string]));
    _uuidToSlug = new Map((data ?? []).map((r: any) => [r.book_id as string, r.local_id as string]));
  }
  return { slugToUuid: _slugToUuid!, uuidToSlug: _uuidToSlug! };
}

/** Find the direct-child-of-root ancestor for a category (the "author/collection" level). */
export function collectionName(catalog: Catalog, catId: string): string {
  const catMap = new Map(catalog.categories.map(c => [c.id, c]));
  let cur = catMap.get(catId);
  if (!cur) return '';
  // Walk up until parent is a root (parentId = null)
  while (cur && cur.parentId) {
    const parent = catMap.get(cur.parentId);
    if (!parent || parent.parentId === null) break; // parent is root — stop here
    cur = parent;
  }
  return cur?.name ?? '';
}

/** Get the root tradition name for a category. */
export function traditionName(catalog: Catalog, catId: string): string {
  const catMap = new Map(catalog.categories.map(c => [c.id, c]));
  let cur = catMap.get(catId);
  while (cur?.parentId) cur = catMap.get(cur.parentId);
  return cur?.name ?? '';
}
