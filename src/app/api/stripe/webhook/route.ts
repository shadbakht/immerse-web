import { NextResponse } from 'next/server';
import Stripe from 'stripe';
import { createClient } from '@/lib/supabase/server';

export const runtime = 'nodejs';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);

export async function POST(request: Request) {
  const body      = await request.text();
  const signature = request.headers.get('stripe-signature')!;

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(body, signature, process.env.STRIPE_WEBHOOK_SECRET!);
  } catch {
    return NextResponse.json({ error: 'Invalid signature' }, { status: 400 });
  }

  const supabase = await createClient();

  if (event.type === 'checkout.session.completed') {
    const session = event.data.object as Stripe.Checkout.Session;
    const userId  = session.metadata?.supabase_user_id;
    if (userId && session.subscription) {
      await supabase.from('profiles').update({
        is_pro:                    true,
        stripe_subscription_id:    session.subscription as string,
        stripe_subscription_status: 'active',
      }).eq('id', userId);
    }
  }

  if (event.type === 'customer.subscription.updated') {
    const sub    = event.data.object as Stripe.Subscription;
    const userId = sub.metadata?.supabase_user_id;
    if (userId) {
      const active = sub.status === 'active' || sub.status === 'trialing';
      await supabase.from('profiles').update({
        is_pro:                    active,
        stripe_subscription_status: sub.status,
      }).eq('id', userId);
    }
  }

  if (event.type === 'customer.subscription.deleted') {
    const sub    = event.data.object as Stripe.Subscription;
    const userId = sub.metadata?.supabase_user_id;
    if (userId) {
      await supabase.from('profiles').update({
        is_pro:                    false,
        stripe_subscription_status: 'canceled',
      }).eq('id', userId);
    }
  }

  return NextResponse.json({ received: true });
}
