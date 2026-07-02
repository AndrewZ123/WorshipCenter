import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from './supabase';

/**
 * Server-side subscription verification middleware
 * This prevents subscription bypass by checking subscription status on the server
 */
export async function requireActiveSubscription(
  request: NextRequest
): Promise<boolean | NextResponse> {
  const token = request.headers.get('authorization')?.replace('Bearer ', '');
  
  if (!token) {
    return NextResponse.json(
      { error: 'Authentication required' },
      { status: 401 }
    );
  }

  const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(token);
  
  if (authError || !user) {
    return NextResponse.json(
      { error: 'Invalid session' },
      { status: 401 }
    );
  }

  // Get user's church_id
  const { data: profile, error: profileError } = await supabaseAdmin
    .from('users')
    .select('church_id')
    .eq('id', user.id)
    .single();

  if (profileError || !profile?.church_id) {
    return NextResponse.json(
      { error: 'Church not found' },
      { status: 404 }
    );
  }

  // Get subscription status
  const { data: subscription, error: subError } = await supabaseAdmin
    .from('subscriptions')
    .select('status, trial_end, current_period_end')
    .eq('church_id', profile.church_id)
    .single();

  if (subError || !subscription) {
    return NextResponse.json(
      { error: 'Subscription required' },
      { status: 402 }
    );
  }

  // Check if subscription is active
  const isActive = subscription.status === 'active';
  
  // Check if still trialing
  const isTrialing = subscription.status === 'trialing' && 
    subscription.trial_end && 
    new Date(subscription.trial_end) > new Date();

  // Check if recently expired (grace period)
  const isGracePeriod = subscription.status === 'past_due' &&
    subscription.current_period_end &&
    new Date(subscription.current_period_end) > new Date();

  if (!isActive && !isTrialing && !isGracePeriod) {
    return NextResponse.json(
      { 
        error: 'Subscription required',
        message: 'Please upgrade your subscription to continue using WorshipCenter.',
        status: subscription.status,
        trialEnd: subscription.trial_end
      },
      { status: 402 }
    );
  }

  return true;
}

/**
 * Check subscription status without blocking
 * Returns subscription info for conditional logic
 */
export async function checkSubscriptionStatus(
  token: string
): Promise<{
  hasAccess: boolean;
  isActive: boolean;
  isTrialing: boolean;
  isGracePeriod: boolean;
  status: string;
  trialEnd?: string;
} | null> {
  const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(token);
  
  if (authError || !user) {
    return null;
  }

  const { data: profile } = await supabaseAdmin
    .from('users')
    .select('church_id')
    .eq('id', user.id)
    .single();

  if (!profile?.church_id) {
    return null;
  }

  const { data: subscription } = await supabaseAdmin
    .from('subscriptions')
    .select('status, trial_end, current_period_end')
    .eq('church_id', profile.church_id)
    .single();

  if (!subscription) {
    return null;
  }

  const isActive = subscription.status === 'active';
  const isTrialing = subscription.status === 'trialing' && 
    subscription.trial_end && 
    new Date(subscription.trial_end) > new Date();
  const isGracePeriod = subscription.status === 'past_due' &&
    subscription.current_period_end &&
    new Date(subscription.current_period_end) > new Date();

  return {
    hasAccess: isActive || isTrialing || isGracePeriod,
    isActive,
    isTrialing,
    isGracePeriod,
    status: subscription.status,
    trialEnd: subscription.trial_end
  };
}