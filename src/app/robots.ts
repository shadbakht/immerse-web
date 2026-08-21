import type { MetadataRoute } from 'next';
import { SITE_URL } from '@/lib/siteUrl';

// Everything reachable without an account is meant to be crawlable — that's
// the whole point of opening /read/[bookId] to guests (see
// project_session_aug21_growth_websync_queue.md queue item #1). /login and
// the API routes have nothing worth indexing and no reason to be disallowed
// either; robots.txt only needs to point crawlers at the sitemap.
export default function robots(): MetadataRoute.Robots {
  return {
    rules: { userAgent: '*', allow: '/' },
    sitemap: `${SITE_URL}/sitemap.xml`,
  };
}
