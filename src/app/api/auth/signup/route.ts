import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { createClient } from '@supabase/supabase-js';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { churchName, userName, email, password, authUserId } = body;

    // Validate required fields
    if (!churchName || !userName || !email || !password || !authUserId) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
    }

    if (password.length < 6) {
      return NextResponse.json(
        { error: 'Password must be at least 6 characters' },
        { status: 400 }
      );
    }

    // 1. Generate a unique slug from the church name
    let slugBase = churchName
      .toLowerCase()
      .replace(/[^a-z0-9]/g, '-')
      .replace(/-+/g, '-')
      .replace(/^-|-$/g, '');
    let slug = slugBase;
    let counter = 0;

    // Check slug uniqueness using admin client
    while (true) {
      const { data: existing } = await supabaseAdmin
        .from('churches')
        .select('id')
        .eq('slug', slug)
        .maybeSingle();

      if (!existing) break;
      counter++;
      slug = `${slugBase}-${counter}`;
    }

    // 2. Create the church
    const { data: churchData, error: churchError } = await supabaseAdmin
      .from('churches')
      .insert({ name: churchName, slug })
      .select('id')
      .single();

    if (churchError || !churchData) {
      console.error('[Signup API] Church creation error:', churchError?.message);
      return NextResponse.json(
        { error: `Failed to create church: ${churchError?.message}` },
        { status: 500 }
      );
    }

    const churchId = churchData.id;

    // 3. Create subscription (use upsert to handle potential trigger race condition)
    const { error: subError } = await supabaseAdmin
      .from('subscriptions')
      .upsert(
        {
          church_id: churchId,
          stripe_customer_id: 'cus_pending_' + crypto.randomUUID().replace(/-/g, ''),
          stripe_subscription_id: null,
          status: 'trialing',
          trial_start: new Date().toISOString(),
          trial_end: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString(),
          current_period_start: null,
          current_period_end: null,
          cancel_at_period_end: false,
        },
        { onConflict: 'church_id' }
      );

    if (subError) {
      console.warn('[Signup API] Subscription upsert warning:', subError.message);
      // Don't fail signup - the trigger may have already created it
    }

    // 4. Create the user profile
    const { error: userError } = await supabaseAdmin
      .from('users')
      .insert({
        id: authUserId,
        church_id: churchId,
        name: userName,
        email: email,
        role: 'admin',
      });

    if (userError) {
      console.error('[Signup API] User profile creation error:', userError.message);
      // Try to clean up the church we just created
      await supabaseAdmin.from('churches').delete().eq('id', churchId);
      return NextResponse.json(
        { error: `Failed to create user profile: ${userError.message}` },
        { status: 500 }
      );
    }

    // 5. Create team member entry for the worship leader
    const { error: teamMemberError } = await supabaseAdmin
      .from('team_members')
      .insert({
        church_id: churchId,
        name: userName,
        email: email,
        phone: '',
        roles: ['Worship Leader'],
        user_id: authUserId,
      });

    if (teamMemberError) {
      console.warn('[Signup API] Team member creation warning:', teamMemberError.message);
      // Don't fail signup for this - it's not critical
    }

    console.log('[Signup API] Success! Church created:', churchId);

    return NextResponse.json({
      success: true,
      church_id: churchId,
    });
  } catch (err: any) {
    console.error('[Signup API] Unexpected error:', err);
    return NextResponse.json(
      { error: err.message || 'Internal server error' },
      { status: 500 }
    );
  }
}