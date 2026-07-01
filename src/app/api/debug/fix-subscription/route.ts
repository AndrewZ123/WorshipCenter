import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { env } from '@/lib/env';

/**
 * DEBUG ENDPOINT: Fix missing subscription for a user's church
 * 
 * This endpoint will:
 * 1. Find the authenticated user's church
 * 2. Check if a subscription exists
 * 3. Create one if missing
 * 
 * POST to use this endpoint
 */
export async function POST(request: NextRequest) {
  try {
    const supabase = createClient(
      env.supabaseUrl(),
      env.supabaseServiceRoleKey()
    );

    // Get user from auth header
    const authHeader = request.headers.get('authorization');
    if (!authHeader) {
      return NextResponse.json({ error: 'Authorization header required' }, { status: 401 });
    }

    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    
    if (authError || !user) {
      console.error('[Fix Subscription] Auth error:', authError);
      return NextResponse.json({ error: 'Invalid or expired session', authError }, { status: 401 });
    }

    // Get user's church_id - check if user exists in public.users
    let userData;
    let userError;
    
    try {
      const result = await supabase
        .from('users')
        .select('id, email, church_id, role')
        .eq('id', user.id)
        .single();
      
      userData = result.data;
      userError = result.error;
    } catch (e) {
      userError = e;
    }

    let churchId: string;

    if (userData?.church_id) {
      // User exists and has church_id
      churchId = userData.church_id;
    } else if (userData && !userData.church_id) {
      // User exists but has no church_id
      return NextResponse.json({ 
        error: 'User exists but has no church_id', 
        userId: user.id 
      }, { status: 400 });
    } else {
      // User doesn't exist in public.users - need to create them
      console.log('[Fix Subscription] User missing from public.users, creating record...');
      
      // Create a new church for this user
      const newChurchId = crypto.randomUUID();
      const nowIso = new Date().toISOString();
      
      // Create church
      const { error: churchError } = await supabase
        .from('churches')
        .insert({
          id: newChurchId,
          name: `${user.email}'s Church`,
          created_at: nowIso,
          updated_at: nowIso,
        });

      if (churchError) {
        console.error('[Fix Subscription] Failed to create church:', churchError);
        return NextResponse.json({ error: 'Failed to create church', churchError }, { status: 500 });
      }

      // Create user record
      const { error: createUserError } = await supabase
        .from('users')
        .insert({
          id: user.id,
          email: user.email,
          church_id: newChurchId,
          role: 'admin',
          avatar_url: null,
          created_at: nowIso,
          updated_at: nowIso,
        });

      if (createUserError) {
        console.error('[Fix Subscription] Failed to create user:', createUserError);
        return NextResponse.json({ error: 'Failed to create user record', createUserError }, { status: 500 });
      }

      churchId = newChurchId;
      console.log('[Fix Subscription] Created user and church:', churchId);
    }

    // Check if subscription already exists
    const { data: existingSub, error: subError } = await supabase
      .from('subscriptions')
      .select('*')
      .eq('church_id', churchId)
      .single();

    if (subError && subError.code !== 'PGRST116') {
      // Real error, not "not found"
      console.error('[Fix Subscription] Subscription query error:', subError);
      return NextResponse.json({ error: 'Failed to query subscriptions', subError }, { status: 500 });
    }

    if (existingSub) {
      return NextResponse.json({ 
        message: 'Subscription already exists',
        subscription: existingSub,
      });
    }

    // No subscription exists - create one
    console.log('[Fix Subscription] Creating subscription for church:', churchId);
    
    const nowIso = new Date().toISOString();
    const trialEndIso = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString();

    const { data: createdSub, error: createError } = await supabase
      .from('subscriptions')
      .insert({
        id: crypto.randomUUID(),
        church_id: churchId,
        stripe_customer_id: null,
        stripe_subscription_id: null,
        status: 'trialing',
        price_type: null,
        trial_start: nowIso,
        trial_end: trialEndIso,
        current_period_start: nowIso,
        current_period_end: trialEndIso,
        cancel_at_period_end: false,
        created_at: nowIso,
        updated_at: nowIso,
      })
      .select('*')
      .single();

    if (createError || !createdSub) {
      console.error('[Fix Subscription] Failed to create subscription:', createError);
      return NextResponse.json({ 
        error: 'Failed to create subscription', 
        createError 
      }, { status: 500 });
    }

    console.log('[Fix Subscription] Subscription created successfully:', createdSub.id);

    return NextResponse.json({ 
      message: 'Subscription created successfully',
      subscription: createdSub,
      user: userData,
    });

  } catch (error) {
    console.error('[Fix Subscription] Unexpected error:', error);
    return NextResponse.json(
      { error: 'Failed to fix subscription', details: String(error) },
      { status: 500 }
    );
  }
}