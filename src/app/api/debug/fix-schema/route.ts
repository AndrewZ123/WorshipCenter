import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { env } from '@/lib/env';

/**
 * DEBUG ENDPOINT: Fix schema issues by adding missing columns
 * 
 * This endpoint will:
 * 1. Add price_type and canceled_at columns to subscriptions table if missing
 * 2. Then create missing user/church/subscription
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
      console.error('[Fix Schema] Auth error:', authError);
      return NextResponse.json({ error: 'Invalid or expired session', authError }, { status: 401 });
    }

    // Step 1: Add missing columns to subscriptions table
    console.log('[Fix Schema] Adding missing columns to subscriptions table...');
    
    // Try to add price_type column
    try {
      await supabase.rpc('exec_sql', {
        sql: `ALTER TABLE subscriptions ADD COLUMN IF NOT EXISTS price_type TEXT CHECK (price_type IN ('monthly', 'yearly'));`
      });
    } catch (e) {
      // Ignore errors - column might already exist
      console.log('[Fix Schema] Could not add price_type column (may already exist):', e);
    }

    // Try to add canceled_at column
    try {
      await supabase.rpc('exec_sql', {
        sql: `ALTER TABLE subscriptions ADD COLUMN IF NOT EXISTS canceled_at TIMESTAMPTZ;`
      });
    } catch (e) {
      console.log('[Fix Schema] Could not add canceled_at column (may already exist):', e);
    }

    console.log('[Fix Schema] Schema updates completed');

    // Step 2: Create user/church/subscription if missing
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
      churchId = userData.church_id;
    } else if (userData && !userData.church_id) {
      return NextResponse.json({ 
        error: 'User exists but has no church_id', 
        userId: user.id 
      }, { status: 400 });
    } else {
      console.log('[Fix Schema] User missing from public.users, creating record...');
      
      const newChurchId = crypto.randomUUID();
      const nowIso = new Date().toISOString();
      
      const { error: churchError } = await supabase
        .from('churches')
        .insert({
          id: newChurchId,
          name: `${user.email}'s Church`,
          created_at: nowIso,
          updated_at: nowIso,
        });

      if (churchError) {
        console.error('[Fix Schema] Failed to create church:', churchError);
        return NextResponse.json({ error: 'Failed to create church', churchError }, { status: 500 });
      }

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
        console.error('[Fix Schema] Failed to create user:', createUserError);
        return NextResponse.json({ error: 'Failed to create user record', createUserError }, { status: 500 });
      }

      churchId = newChurchId;
      console.log('[Fix Schema] Created user and church:', churchId);
    }

    // Check if subscription already exists
    const { data: existingSub, error: subError } = await supabase
      .from('subscriptions')
      .select('*')
      .eq('church_id', churchId)
      .single();

    if (subError && subError.code !== 'PGRST116') {
      console.error('[Fix Schema] Subscription query error:', subError);
      return NextResponse.json({ error: 'Failed to query subscriptions', subError }, { status: 500 });
    }

    if (existingSub) {
      return NextResponse.json({ 
        message: 'Subscription already exists',
        subscription: existingSub,
      });
    }

    // Create subscription
    console.log('[Fix Schema] Creating subscription for church:', churchId);
    
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
        canceled_at: null,
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
      console.error('[Fix Schema] Failed to create subscription:', createError);
      return NextResponse.json({ 
        error: 'Failed to create subscription', 
        createError 
      }, { status: 500 });
    }

    console.log('[Fix Schema] Subscription created successfully:', createdSub.id);

    return NextResponse.json({ 
      message: 'Schema fixed and subscription created successfully',
      subscription: createdSub,
    });

  } catch (error) {
    console.error('[Fix Schema] Unexpected error:', error);
    return NextResponse.json(
      { error: 'Failed to fix schema', details: String(error) },
      { status: 500 }
    );
  }
}