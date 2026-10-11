import { NextResponse } from 'next/server';
import Stripe from 'stripe';
import { createClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);
  // `plan: 'lifetime'` is the one-time purchase, reached only from the unlisted
  // /lifetime page. Anything else is the monthly subscription, as before.
  const body = await request.json().catch(() => ({}));
  const lifetime = body?.plan === 'lifetime';
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  // Reuse existing Stripe customer if we have one
  const { data: profile } = await supabase
    .from('profiles')
    .select('stripe_customer_id, full_name')
    .eq('id', user.id)
    .single();

  let customerId = profile?.stripe_customer_id as string | undefined;
  if (!customerId) {
    const customer = await stripe.customers.create({
      email: user.email,
      name:  profile?.full_name || undefined,
      metadata: { supabase_user_id: user.id },
    });
    customerId = customer.id;
    await supabase.from('profiles').update({ stripe_customer_id: customerId }).eq('id', user.id);
  }

  const origin = process.env.NEXT_PUBLIC_SITE_URL || 'https://immerseresearch.app';

  if (lifetime && !process.env.STRIPE_LIFETIME_PRICE_ID) {
    console.error('[stripe/checkout] STRIPE_LIFETIME_PRICE_ID is not set');
    return NextResponse.json({ error: 'lifetime_unavailable' }, { status: 500 });
  }

  const session = await stripe.checkout.sessions.create({
    customer:            customerId,
    mode:                lifetime ? 'payment' : 'subscription',
    payment_method_types: ['card'],
    line_items: [{
      price:    lifetime ? process.env.STRIPE_LIFETIME_PRICE_ID! : process.env.STRIPE_PRICE_ID!,
      quantity: 1,
    }],
    // Settings is a client-side tab inside AppShell — there is no /settings
    // route (AppShell reads ?tab=settings on mount). Plain /settings 404s.
    success_url: `${origin}/?tab=settings&upgraded=1`,
    cancel_url:  lifetime ? `${origin}/lifetime` : `${origin}/?tab=settings`,
    metadata: { supabase_user_id: user.id, ...(lifetime ? { plan: 'lifetime' } : {}) },
    ...(lifetime ? {} : { subscription_data: { metadata: { supabase_user_id: user.id } } }),
  });

  return NextResponse.json({ url: session.url });
}
