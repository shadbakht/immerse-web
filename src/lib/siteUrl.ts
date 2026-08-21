// The canonical origin, used anywhere metadata/sitemaps need an absolute URL
// (canonical links, OG tags, sitemap entries, JSON-LD @id/url). Vercel sets
// NEXT_PUBLIC_SITE_URL in production; the fallback keeps local dev and any
// build without it from crashing (same fallback the Stripe routes already use).
export const SITE_URL = (process.env.NEXT_PUBLIC_SITE_URL || 'https://immerseresearch.app').replace(/\/+$/, '');
