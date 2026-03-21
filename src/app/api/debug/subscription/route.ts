import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { getStripe } from '@/lib/stripe';

const getSupabase = () => createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function GET(request: NextRequest) {
  const supabase = getSupabase();
  const stripe = getStripe();
  
  // Get all subscriptions
  const { data: subscriptions, error: subError } = await supabase
    .from('subscriptions')
    .select('*');
  
  if (subError) {
    return NextResponse.json({ error: subError.message }, { status: 500 });
  }
  
  // For each subscription, check Stripe
  const results = await Promise.all(
    (subscriptions || []).map(async (sub: any) => {
      let stripeSub = null;
      let stripeError = null;
      
      if (sub.stripe_subscription_id) {
        try {
          const response = await stripe.subscriptions.retrieve(sub.stripe_subscription_id);
          stripeSub = response as any;
        } catch (e: any) {
          stripeError = e.message;
        }
      }
      
      return {
        church_id: sub.church_id,
        database_status: sub.status,
        database_trial_end: sub.trial_end,
        database_stripe_sub_id: sub.stripe_subscription_id,
        stripe_status: (stripeSub as any)?.status || null,
        stripe_trial_end: (stripeSub as any)?.trial_end ? new Date((stripeSub as any).trial_end * 1000).toISOString() : null,
        stripe_current_period_end: (stripeSub as any)?.current_period_end ? new Date((stripeSub as any).current_period_end * 1000).toISOString() : null,
        stripe_error: stripeError,
        needs_sync: sub.status !== (stripeSub as any)?.status,
      };
    })
  );
  
  return NextResponse.json({ subscriptions: results });
}