import type { MetadataRoute } from 'next';
import { SITE_URL } from '@/lib/siteUrl';
import { loadCatalogServer } from '@/lib/catalogServer';

// One URL per book (1,418 today) plus the home page — well under the 50,000
// per-sitemap cap, so no need to split into a sitemap index.
//
// No hreflang/language `alternates` here: catalog.json gives each book its
// own independent slug with no field linking, say, the English Genesis to
// its Spanish counterpart, so there's no reliable way to say "these two URLs
// are the same work in different languages" without guessing from titles —
// which this project's own sourcing rules explicitly warn against doing.
// Per-book <link rel="alternate" hreflang> can be added once such a mapping
// exists; until then this sitemap only lists real URLs.
export default function sitemap(): MetadataRoute.Sitemap {
  const catalog = loadCatalogServer();
  const lastModified = new Date();

  // No `/c/<id>` share pages here on purpose: they are unlisted, link-only
  // compilations and every one is served with `robots: { index: false }`, so
  // enumerating community_tags into the sitemap would contradict that.
  return [
    { url: SITE_URL, lastModified, changeFrequency: 'daily', priority: 1 },
    ...catalog.books.map(book => ({
      url: `${SITE_URL}/read/${book.id}`,
      lastModified,
      changeFrequency: 'monthly' as const,
      priority: 0.7,
    })),
  ];
}
