import { NextResponse } from 'next/server';
import Stripe from 'stripe';
import { createClient } from '@/lib/supabase/server';
import { classifyStripeError } from '@/lib/stripePortal';

export const dynamic = 'force-dynamic';

export async function POST() {
  try {
    if (!process.env.STRIPE_SECRET_KEY) {
      console.error('[stripe/portal] STRIPE_SECRET_KEY is not set');
      return NextResponse.json({ error: 'portal_unavailable' }, { status: 500 });
    }
    const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

    const { data: profile } = await supabase
      .from('profiles')
      .select('stripe_customer_id')
      .eq('id', user.id)
      .single();

    if (!profile?.stripe_customer_id) {
      return NextResponse.json({ error: 'no_customer' }, { status: 400 });
    }

    const origin = process.env.NEXT_PUBLIC_SITE_URL || 'https://immerseresearch.app';

    // There is no /settings route — Settings is a client-side tab inside
    // AppShell — so land back on the root with ?tab=settings, which AppShell
    // reads on mount to switch to that tab. Plain `/settings` 404s.
    const session = await stripe.billingPortal.sessions.create({
      customer:   profile.stripe_customer_id,
      return_url: `${origin}/?tab=settings`,
    });

    return NextResponse.json({ url: session.url });
  } catch (err) {
    const { error, status } = classifyStripeError(err);
    console.error(`[stripe/portal] ${error}:`, err instanceof Error ? err.message : err);
    return NextResponse.json({ error }, { status });
  }
}
