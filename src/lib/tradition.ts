/**
 * tradition.ts — resolve a Supabase book uuid to its root catalog category
 * (the "tradition"), the way the XRefs screen has always done it.
 *
 * Factored out of `XRefsScreen.tsx` in Phase 8 so the public `/c/<id>` shared
 * cross-reference page groups by exactly the same pairs the owner sees, with
 * no second copy of the walk-up-to-root logic to drift. Part E's share-creation
 * UI reuses this too.
 *
 * The catalog is keyed by corpus SLUG, Supabase by UUID, so the caller supplies
 * `book_slug_map`'s `uuidToSlug` (see `loadSlugMaps`).
 */
import type { Catalog, CatalogBook, CatalogCategory } from '@/lib/catalog';
import type { Tradition } from '@/lib/sharedSets';

/**
 * Build a `bookUuid → { id, name }` resolver.
 *
 * `otherName` is the caller's translated `common.otherTradition` — this module
 * stays free of React/i18n so it can be unit-tested and reused server-side.
 *
 * An unmapped book falls back to its own uuid as the tradition id (so two
 * different unknown books never collapse into one pair) with `otherName` as
 * the display name — the pre-existing XRefs screen behaviour, preserved.
 */
export function makeTraditionResolver(
  catalog: Catalog,
  uuidToSlug: Map<string, string>,
  otherName: string,
): (bookUuid: string) => Tradition {
  const catMap = new Map<string, CatalogCategory>(catalog.categories.map(c => [c.id, c]));
  const bookMap = new Map<string, CatalogBook>(catalog.books.map(b => [b.id, b]));

  const rootCat = (catId: string): CatalogCategory | null => {
    let c = catMap.get(catId);
    while (c?.parentId) c = catMap.get(c.parentId);
    return c ?? null;
  };

  return (bookUuid: string): Tradition => {
    const slug = uuidToSlug.get(bookUuid) ?? '';
    const catBook = slug ? bookMap.get(slug) : null;
    const root = catBook ? rootCat(catBook.categoryId) : null;
    return { id: root?.id ?? bookUuid, name: root?.name ?? otherName };
  };
}
