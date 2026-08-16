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

  // Redirect unauthenticated users to /login (except on auth pages)
  const { pathname, searchParams } = request.nextUrl;
  const publicPaths = ['/login', '/auth', '/read', '/privacy', '/support'];
  const isPublic = publicPaths.some(p => pathname.startsWith(p))
    || (pathname === '/' && searchParams.get('guest') === '1');

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
  matcher: ['/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|json|txt|ico|woff2?|map|mjs)$).*)'],
};
