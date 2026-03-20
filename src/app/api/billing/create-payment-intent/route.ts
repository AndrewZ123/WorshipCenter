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
    const { priceType } = await request.json(); // 'monthly' or 'yearly'
    
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

    const { data: subscription } = await supabase
      .from('subscriptions')
      .select('*')
      .eq('church_id', userData.church_id)
      .single();

    if (!subscription) {
      return NextResponse.json({ error: 'Subscription not found' }, { status: 404 });
    }

    // Get or create Stripe customer
    let customerId = subscription.stripe_customer_id;
    
    if (customerId.startsWith('cus_pending_')) {
      // Create a new Stripe customer
      const customer = await stripe.customers.create({
        email: user.email,
        metadata: {
          church_id: userData.church_id,
          user_id: user.id,
        },
      });
      customerId = customer.id;

      // Update subscription with real customer ID
      await supabase
        .from('subscriptions')
        .update({ stripe_customer_id: customerId })
        .eq('church_id', userData.church_id);
    }

    // Determine the amount
    const amount = priceType === 'yearly' ? PRICING.yearlyPrice : PRICING.monthlyPrice;
    
    // Create a Payment Intent for the subscription
    const paymentIntent = await stripe.paymentIntents.create({
      amount,
      currency: 'usd',
      customer: customerId,
      automatic_payment_methods: {
        enabled: true,
      },
      metadata: {
        church_id: userData.church_id,
        price_type: priceType,
        user_id: user.id,
      },
      setup_future_usage: 'off_session', // Allows saving the payment method for future use
    });

    return NextResponse.json({ 
      clientSecret: paymentIntent.client_secret,
      customerId,
      amount,
      priceType,
    });
  } catch (error) {
    console.error('Error creating payment intent:', error);
    return NextResponse.json(
      { error: 'Failed to create payment intent' },
      { status: 500 }
    );
  }
}