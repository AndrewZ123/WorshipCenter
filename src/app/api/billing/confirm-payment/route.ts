import { NextRequest, NextResponse } from 'next/server';
import { getStripe, PRICING } from '@/lib/stripe';
import { createClient } from '@supabase/supabase-js';

// Lazy initialization of Supabase client
const getSupabase = () => createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(request: NextRequest) {
  const supabase = getSupabase();
  const stripe = getStripe();
  
  try {
    const { paymentIntentId, priceType } = await request.json();
    
    // Get user from auth header
    const authHeader = request.headers.get('authorization');
    if (!authHeader) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get user's church and subscription
    const { data: userData } = await supabase
      .from('users')
      .select('church_id')
      .eq('id', user.id)
      .single();

    if (!userData?.church_id) {
      return NextResponse.json({ error: 'Church not found' }, { status: 404 });
    }

    // Retrieve the payment intent to get the payment method
    const paymentIntent = await stripe.paymentIntents.retrieve(paymentIntentId);

    if (paymentIntent.status !== 'succeeded') {
      return NextResponse.json({ error: 'Payment not successful' }, { status: 400 });
    }

    // Get the subscription record
    const { data: subscription } = await supabase
      .from('subscriptions')
      .select('*')
      .eq('church_id', userData.church_id)
      .single();

    if (!subscription) {
      return NextResponse.json({ error: 'Subscription not found' }, { status: 404 });
    }

    // Create Stripe subscription
    const priceId = priceType === 'yearly' ? PRICING.yearlyPriceId : PRICING.monthlyPriceId;
    
    const stripeSubscription = await stripe.subscriptions.create({
      customer: paymentIntent.customer as string,
      items: [
        {
          price: priceId,
        },
      ],
      payment_behavior: 'default_incomplete',
      payment_settings: {
        payment_method_types: ['card'],
        save_default_payment_method: 'on_subscription',
      },
      expand: ['latest_invoice.payment_intent'],
      metadata: {
        church_id: userData.church_id,
        user_id: user.id,
      },
    });

    // Calculate trial period end
    const trialPeriodEnd = new Date();
    trialPeriodEnd.setDate(trialPeriodEnd.getDate() + PRICING.trialDays);

    // Update subscription in database
    await supabase
      .from('subscriptions')
      .update({
        stripe_subscription_id: stripeSubscription.id,
        stripe_customer_id: paymentIntent.customer as string,
        stripe_price_id: priceId,
        status: 'trialing',
        trial_end: trialPeriodEnd.toISOString(),
        current_period_start: new Date().toISOString(),
        current_period_end: trialPeriodEnd.toISOString(),
        cancel_at_period_end: false,
      })
      .eq('church_id', userData.church_id);

    return NextResponse.json({ 
      success: true,
      subscriptionId: stripeSubscription.id,
    });
  } catch (error) {
    console.error('Error confirming payment:', error);
    return NextResponse.json(
      { error: 'Failed to confirm payment' },
      { status: 500 }
    );
  }
}