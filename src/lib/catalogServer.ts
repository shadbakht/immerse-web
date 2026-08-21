// Server-only catalog access for metadata generation (sitemap.ts, per-book
// generateMetadata). Reads public/catalog.json straight off disk instead of
// fetching it over HTTP: fetching '/catalog.json' from a server component
// needs an absolute URL and a live request round-trip on every build/request,
// where a literal fs.readFileSync(path.join(process.cwd(), 'public', ...))
// call is both simpler and something Next's build-time file tracer can see
// and bundle into the deployed function. Never import this from a Client
// Component — the `fs`/`path` imports alone will fail a client bundle, but
// don't rely on that as the only guard; only call it from server files
// (sitemap.ts, robots.ts, generateMetadata).
import fs from 'node:fs';
import path from 'node:path';
import type { Catalog } from './catalog';
import { collectionName, traditionName } from './catalog';

let _catalog: Catalog | null = null;

export function loadCatalogServer(): Catalog {
  if (!_catalog) {
    const raw = fs.readFileSync(path.join(process.cwd(), 'public', 'catalog.json'), 'utf8');
    _catalog = JSON.parse(raw) as Catalog;
  }
  return _catalog;
}

export function findBook(catalog: Catalog, bookId: string) {
  return catalog.books.find(b => b.id === bookId) ?? null;
}

// A short, honest description built from what the catalog actually knows —
// title, author/collection, and tradition. No fabricated summary text.
export function bookDescription(catalog: Catalog, bookId: string): string | null {
  const book = findBook(catalog, bookId);
  if (!book) return null;
  const collection = collectionName(catalog, book.categoryId);
  const tradition = traditionName(catalog, book.categoryId);
  const by = collection && collection !== tradition ? `${collection} — ` : '';
  return `${by}${tradition ? `${tradition} scripture` : 'Sacred text'}. Read “${book.title}” free online at Immerse.`;
}
