import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get('code');
  const type = searchParams.get('type'); // 'signup' for email confirmation
  const next = searchParams.get('next') ?? '/';

  if (code) {
    const supabase = await createClient();
    await supabase.auth.exchangeCodeForSession(code);
  }

  // After email confirmation, show a friendly success page instead of the app
  if (type === 'signup' || type === 'email_change') {
    return NextResponse.redirect(`${origin}/auth/confirmed`);
  }

  return NextResponse.redirect(`${origin}${next}`);
}
