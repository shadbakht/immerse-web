import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';

export async function proxy(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => request.cookies.getAll(),
        setAll: (cookiesToSet) => {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          supabaseResponse = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options),
          );
        },
      },
    },
  );

  const { data: { user } } = await supabase.auth.getUser();

  // Redirect unauthenticated users to /login (except on auth pages). '/' is
  // public in its own right (checked by exact match, not startsWith — every
  // path "starts with" '/') so a signed-out visitor lands straight on the
  // guest-mode library instead of being bounced through /login first.
  const { pathname } = request.nextUrl;
  // '/c' = public shared-compilation pages (Phase 5 share links). A signed-out
  // visitor with a link must see the page, not a login bounce — the page's own
  // Save button handles the sign-in redirect when they choose to save.
  // '/.well-known' = apple-app-site-association (no file extension, so the
  // static-asset matcher below doesn't exempt it) + assetlinks.json — the OS
  // fetches these unauthenticated to verify universal / App Links for /c/*.
  const publicPaths = ['/login', '/auth', '/read', '/privacy', '/support', '/c', '/.well-known'];
  const isPublic = pathname === '/' || publicPaths.some(p => pathname.startsWith(p));

  if (!user && !isPublic) {
    const url = request.nextUrl.clone();
    url.pathname = '/login';
    return NextResponse.redirect(url);
  }

  return supabaseResponse;
}

export const config = {
  // Exempt static public assets (incl. catalog.json / slug-map.json, and
  // pdf.worker.min.mjs — pdf.js's Worker script for imported-PDF text
  // extraction, fetched by guests same as anyone) so they serve directly
  // without an auth check or a redirect-to-login. Without `mjs` here, a
  // guest's PDF import silently loses text extraction: the worker fetch gets
  // this proxy's login-redirect HTML instead of the script, pdf.js throws,
  // and extractPdfText's catch just falls back to the view-only PDF path —
  // no crash, just a quiet regression to pre-extraction behavior.
  // `xml` exempts /sitemap.xml (app/sitemap.ts) the same way `txt` already
  // exempts /robots.txt (app/robots.ts) — both are generated static files a
  // crawler fetches unauthenticated, and without this the proxy 302'd
  // /sitemap.xml to /login instead of serving it (caught 2026-08-21 while
  // verifying queue item #2's SEO surface in a local preview).
  matcher: ['/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|json|txt|xml|ico|woff2?|map|mjs)$).*)'],
};
