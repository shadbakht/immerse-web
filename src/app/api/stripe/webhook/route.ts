import { NextResponse } from 'next/server';
import Stripe from 'stripe';
import { createAdminClient } from '@/lib/supabase/admin';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// profiles.stripe_subscription_status value for a one-time lifetime purchase.
// Subscription events must never turn Pro off for a lifetime owner (e.g. the
// monthly plan they had before buying lifetime being cancelled).
const LIFETIME = 'lifetime';

export async function POST(request: Request) {
  const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);
  const body      = await request.text();
  const signature = request.headers.get('stripe-signature')!;

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(body, signature, process.env.STRIPE_WEBHOOK_SECRET!);
  } catch {
    return NextResponse.json({ error: 'Invalid signature' }, { status: 400 });
  }

  // Service role, not the cookie client: a webhook has no user session, so the
  // anon client's profiles updates are filtered out by RLS and silently write
  // nothing. Failures below return 500 so Stripe retries instead of dropping.
  const supabase = createAdminClient();

  async function isLifetime(userId: string): Promise<boolean> {
    const { data } = await supabase
      .from('profiles').select('stripe_subscription_status').eq('id', userId).maybeSingle();
    return data?.stripe_subscription_status === LIFETIME;
  }

  if (event.type === 'checkout.session.completed') {
    const session = event.data.object as Stripe.Checkout.Session;
    const userId  = session.metadata?.supabase_user_id;

    if (userId && session.mode === 'payment' && session.metadata?.plan === 'lifetime') {
      if (session.payment_status === 'paid') {
        // Read the old subscription BEFORE overwriting the row, so a monthly
        // subscriber who buys lifetime stops being billed.
        const { data: prior } = await supabase
          .from('profiles').select('stripe_subscription_id').eq('id', userId).maybeSingle();

        const { error } = await supabase.from('profiles').update({
          is_pro:                     true,
          stripe_subscription_id:     null,
          stripe_subscription_status: LIFETIME,
        }).eq('id', userId);
        if (error) {
          console.error('[stripe/webhook] lifetime grant failed', error);
          return NextResponse.json({ error: 'db_error' }, { status: 500 });
        }

        if (prior?.stripe_subscription_id) {
          try { await stripe.subscriptions.cancel(prior.stripe_subscription_id); }
          catch (e) { console.error('[stripe/webhook] could not cancel prior subscription', e); }
        }
      }
    } else if (userId && session.subscription) {
      const { error } = await supabase.from('profiles').update({
        is_pro:                    true,
        stripe_subscription_id:    session.subscription as string,
        stripe_subscription_status: 'active',
      }).eq('id', userId).neq('stripe_subscription_status', LIFETIME);
      if (error) {
        console.error('[stripe/webhook] subscription grant failed', error);
        return NextResponse.json({ error: 'db_error' }, { status: 500 });
      }
    }
  }

  if (event.type === 'customer.subscription.updated') {
    const sub    = event.data.object as Stripe.Subscription;
    const userId = sub.metadata?.supabase_user_id;
    if (userId && !(await isLifetime(userId))) {
      const active = sub.status === 'active' || sub.status === 'trialing';
      const { error } = await supabase.from('profiles').update({
        is_pro:                    active,
        stripe_subscription_status: sub.status,
      }).eq('id', userId);
      if (error) {
        console.error('[stripe/webhook] subscription update failed', error);
        return NextResponse.json({ error: 'db_error' }, { status: 500 });
      }
    }
  }

  if (event.type === 'customer.subscription.deleted') {
    const sub    = event.data.object as Stripe.Subscription;
    const userId = sub.metadata?.supabase_user_id;
    if (userId && !(await isLifetime(userId))) {
      const { error } = await supabase.from('profiles').update({
        is_pro:                    false,
        stripe_subscription_status: 'canceled',
      }).eq('id', userId);
      if (error) {
        console.error('[stripe/webhook] subscription delete failed', error);
        return NextResponse.json({ error: 'db_error' }, { status: 500 });
      }
    }
  }

  return NextResponse.json({ received: true });
}
