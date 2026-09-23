import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get('code');
  const type = searchParams.get('type'); // 'signup' for email confirmation
  const next = searchParams.get('next') ?? '/';

  if (code) {
    const supabase = await createClient();
    const { data } = await supabase.auth.exchangeCodeForSession(code);

    // Google/Apple sign-in whose username was auto-derived, never chosen —
    // the email flow already collects a real one in the signup form, so this
    // only ever fires for a fresh OAuth account (see the handle_new_user
    // migration for why the flag starts false only for those). Detoured here,
    // before `next`, so nothing else in the app is reachable until it's set —
    // same rule the mobile app enforces client-side via AuthContext's
    // needsUsername.
    if (data?.user) {
      const { data: profile } = await supabase
        .from('profiles')
        .select('username_confirmed')
        .eq('id', data.user.id)
        .maybeSingle();
      if (profile?.username_confirmed === false) {
        return NextResponse.redirect(`${origin}/auth/choose-username?next=${encodeURIComponent(next)}`);
      }
    }
  }

  // After email confirmation, show a friendly success page instead of the app
  if (type === 'signup' || type === 'email_change') {
    return NextResponse.redirect(`${origin}/auth/confirmed`);
  }

  return NextResponse.redirect(`${origin}${next}`);
}
