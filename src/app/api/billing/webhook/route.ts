import { NextRequest, NextResponse } from 'next/server';
import { getStripe, PRICING } from '@/lib/stripe';
import Stripe from 'stripe';
import { createClient } from '@supabase/supabase-js';

// Lazy initialization helpers
const getSupabase = () => createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const getWebhookSecret = () => process.env.STRIPE_WEBHOOK_SECRET!;

export async function POST(request: NextRequest) {
  const supabase = getSupabase();
  const stripe = getStripe();
  const webhookSecret = getWebhookSecret();
  
  try {
    const body = await request.text();
    const signature = request.headers.get('stripe-signature')!;

    // Verify webhook signature
    let event: Stripe.Event;
    try {
      event = stripe.webhooks.constructEvent(body, signature, webhookSecret);
    } catch (err) {
      console.error('Webhook signature verification failed:', err);
      return NextResponse.json({ error: 'Invalid signature' }, { status: 400 });
    }

    // Handle the event
    switch (event.type) {
      case 'payment_intent.succeeded': {
        const paymentIntent = event.data.object as Stripe.PaymentIntent;
        const churchId = paymentIntent.metadata?.church_id;
        const priceType = paymentIntent.metadata?.price_type;
        const customerId = paymentIntent.customer as string;

        console.log(`Payment intent succeeded for church ${churchId}, price type ${priceType}`);

        if (churchId && customerId && priceType) {
          // Get price ID from metadata
          const priceId = priceType === 'yearly' 
            ? PRICING.yearlyPriceId 
            : PRICING.monthlyPriceId;

          // Create Stripe subscription
          const stripeSubscription = await stripe.subscriptions.create({
            customer: customerId,
            items: [{ price: priceId }],
            payment_behavior: 'default_incomplete',
            payment_settings: {
              payment_method_types: ['card'],
              save_default_payment_method: 'on_subscription',
            },
            expand: ['latest_invoice.payment_intent'],
            metadata: {
              church_id: churchId,
              price_type: priceType,
            },
          });

          const subData = stripeSubscription as any;
          
          // Update subscription in database
          await supabase
            .from('subscriptions')
            .update({
              stripe_subscription_id: stripeSubscription.id,
              stripe_price_id: priceId,
              status: 'active',
              current_period_start: new Date(subData.current_period_start * 1000).toISOString(),
              current_period_end: new Date(subData.current_period_end * 1000).toISOString(),
              cancel_at_period_end: false,
            })
            .eq('church_id', churchId);

          console.log(`Created subscription ${stripeSubscription.id} for church ${churchId}`);
        }
        break;
      }

      case 'checkout.session.completed': {
        const session = event.data.object as Stripe.Checkout.Session;
        const churchId = session.metadata?.church_id;
        const subscriptionId = session.subscription as string;
        const customerId = session.customer as string;

        if (churchId && subscriptionId) {
          // Get subscription details from Stripe
          const stripeSubscription = await stripe.subscriptions.retrieve(subscriptionId);
          const subData = stripeSubscription as any;
          
          await supabase
            .from('subscriptions')
            .update({
              stripe_customer_id: customerId,
              stripe_subscription_id: subscriptionId,
              status: 'active',
              current_period_start: new Date(subData.current_period_start * 1000).toISOString(),
              current_period_end: new Date(subData.current_period_end * 1000).toISOString(),
            })
            .eq('church_id', churchId);
        }
        break;
      }

      case 'customer.subscription.updated': {
        const subscription = event.data.object as Stripe.Subscription;
        const subscriptionId = subscription.id;
        const subData = subscription as any;
        
        // Get the subscription from our database
        const { data: sub } = await supabase
          .from('subscriptions')
          .select('church_id')
          .eq('stripe_subscription_id', subscriptionId)
          .single();

        if (sub) {
          await supabase
            .from('subscriptions')
            .update({
              status: subscription.status,
              current_period_start: new Date(subData.current_period_start * 1000).toISOString(),
              current_period_end: new Date(subData.current_period_end * 1000).toISOString(),
              cancel_at_period_end: subscription.cancel_at_period_end,
            })
            .eq('church_id', sub.church_id);
        }
        break;
      }

      case 'customer.subscription.deleted': {
        const subscription = event.data.object as Stripe.Subscription;
        const subscriptionId = subscription.id;
        
        const { data: sub } = await supabase
          .from('subscriptions')
          .select('church_id')
          .eq('stripe_subscription_id', subscriptionId)
          .single();

        if (sub) {
          await supabase
            .from('subscriptions')
            .update({
              status: 'canceled',
              stripe_subscription_id: null,
              current_period_start: null,
              current_period_end: null,
            })
            .eq('church_id', sub.church_id);
        }
        break;
      }

      case 'invoice.payment_failed': {
        const invoice = event.data.object as Stripe.Invoice;
        const subscriptionId = (invoice as any).subscription as string;
        
        if (subscriptionId) {
          const { data: sub } = await supabase
            .from('subscriptions')
            .select('church_id')
            .eq('stripe_subscription_id', subscriptionId)
            .single();

          if (sub) {
            await supabase
              .from('subscriptions')
              .update({ status: 'past_due' })
              .eq('church_id', sub.church_id);
          }
        }
        break;
      }

      default:
        console.log(`Unhandled event type: ${event.type}`);
    }

    return NextResponse.json({ received: true });
  } catch (error) {
    console.error('Webhook error:', error);
    return NextResponse.json(
      { error: 'Webhook handler failed' },
      { status: 500 }
    );
  }
}