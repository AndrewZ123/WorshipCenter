import { NextRequest, NextResponse } from 'next/server';
import { getStripe, PRICING } from '@/lib/stripe';
import Stripe from 'stripe';
import { createClient } from '@supabase/supabase-js';
import { env } from '@/lib/env';

// Lazy initialization helpers
const getSupabase = () => createClient(
  env.supabaseUrl(),
  env.supabaseServiceRoleKey()
);

const getWebhookSecret = () => env.stripeWebhookSecret();

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
      // NOTE: We do NOT handle 'payment_intent.succeeded' here.
      // Subscription payments go through Stripe Checkout Sessions,
      // which are handled by 'checkout.session.completed' below.
      // The old payment_intent handler was creating duplicate charges
      // by creating a subscription AFTER a one-time payment intent.

      case 'checkout.session.completed': {
        const session = event.data.object as Stripe.Checkout.Session;
        const churchId = session.metadata?.church_id;
        const subscriptionId = session.subscription as string;
        const customerId = session.customer as string;

        console.log('checkout.session.completed received', { churchId, subscriptionId, customerId });

        if (churchId && subscriptionId) {
          // Get subscription details from Stripe
          const stripeSubscription = await stripe.subscriptions.retrieve(subscriptionId);
          const subData = stripeSubscription as any;
          
          const { error: updateError } = await supabase
            .from('subscriptions')
            .update({
              stripe_customer_id: customerId,
              stripe_subscription_id: subscriptionId,
              status: 'active',
              current_period_start: new Date(subData.current_period_start * 1000).toISOString(),
              current_period_end: new Date(subData.current_period_end * 1000).toISOString(),
              trial_end: null, // Clear trial end when subscription becomes active
              stripe_price_id: subData.items?.data?.[0]?.price?.id || null,
            })
            .eq('church_id', churchId);

          if (updateError) {
            console.error('Failed to update subscription in checkout.session.completed:', updateError);
          } else {
            console.log('Successfully updated subscription for church:', churchId);
          }
        }
        break;
      }

      case 'customer.subscription.updated': {
        const subscription = event.data.object as Stripe.Subscription;
        const subscriptionId = subscription.id;
        const subData = subscription as any;
        
        console.log('customer.subscription.updated received', {
          subscriptionId,
          status: subscription.status,
          cancelAtPeriodEnd: subscription.cancel_at_period_end,
        });

        // Get the subscription from our database
        const { data: sub } = await supabase
          .from('subscriptions')
          .select('church_id, status')
          .eq('stripe_subscription_id', subscriptionId)
          .single();

        if (sub) {
          // Clear trial_end when status changes from trialing to active
          const shouldClearTrialEnd = sub.status === 'trialing' && subscription.status === 'active';
          
          const updateData: any = {
            status: subscription.status,
            current_period_start: new Date(subData.current_period_start * 1000).toISOString(),
            current_period_end: new Date(subData.current_period_end * 1000).toISOString(),
            cancel_at_period_end: subscription.cancel_at_period_end,
          };

          // Add stripe_customer_id if available
          if (subData.customer) {
            updateData.stripe_customer_id = subData.customer as string;
          }

          // Add stripe_price_id if available
          if (subData.items?.data?.[0]?.price?.id) {
            updateData.stripe_price_id = subData.items.data[0].price.id;
          }

          // Clear trial_end when activating from trial
          if (shouldClearTrialEnd) {
            updateData.trial_end = null;
            console.log('Clearing trial_end for subscription transitioning from trialing to active');
          }

          const { error: updateError } = await supabase
            .from('subscriptions')
            .update(updateData)
            .eq('church_id', sub.church_id);

          if (updateError) {
            console.error('Failed to update subscription in customer.subscription.updated:', updateError);
          } else {
            console.log('Successfully updated subscription for church:', sub.church_id, {
              newStatus: subscription.status,
              clearedTrialEnd: shouldClearTrialEnd,
            });
          }
        } else {
          console.error('Subscription not found in database for stripe_subscription_id:', subscriptionId);
        }
        break;
      }

      case 'customer.subscription.deleted': {
        const subscription = event.data.object as Stripe.Subscription;
        const subscriptionId = subscription.id;
        
        console.log('customer.subscription.deleted received', { subscriptionId });

        const { data: sub } = await supabase
          .from('subscriptions')
          .select('church_id')
          .eq('stripe_subscription_id', subscriptionId)
          .single();

        if (sub) {
          const { error: updateError } = await supabase
            .from('subscriptions')
            .update({
              status: 'canceled',
              stripe_subscription_id: null,
              current_period_start: null,
              current_period_end: null,
            })
            .eq('church_id', sub.church_id);

          if (updateError) {
            console.error('Failed to update subscription in customer.subscription.deleted:', updateError);
          } else {
            console.log('Successfully canceled subscription for church:', sub.church_id);
          }
        } else {
          console.error('Subscription not found in database for stripe_subscription_id:', subscriptionId);
        }
        break;
      }

      case 'invoice.payment_failed': {
        const invoice = event.data.object as Stripe.Invoice;
        const subscriptionId = (invoice as any).subscription as string;
        
        console.log('invoice.payment_failed received', { subscriptionId });

        if (subscriptionId) {
          const { data: sub } = await supabase
            .from('subscriptions')
            .select('church_id')
            .eq('stripe_subscription_id', subscriptionId)
            .single();

          if (sub) {
            const { error: updateError } = await supabase
              .from('subscriptions')
              .update({ status: 'past_due' })
              .eq('church_id', sub.church_id);

            if (updateError) {
              console.error('Failed to update subscription in invoice.payment_failed:', updateError);
            } else {
              console.log('Successfully marked subscription as past_due for church:', sub.church_id);
            }
          } else {
            console.error('Subscription not found in database for stripe_subscription_id:', subscriptionId);
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