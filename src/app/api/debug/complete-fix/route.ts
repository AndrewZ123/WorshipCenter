import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';

export async function POST(req: NextRequest) {
  try {
    const authHeader = req.headers.get('Authorization');
    const token = authHeader?.replace('Bearer ', '');
    if (!token) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(token);
    if (authError || !user) {
      return NextResponse.json({ error: 'Invalid or expired session' }, { status: 401 });
    }

    const userId = user.id;
    const email = user.email || 'user@example.com';

    const results: any[] = [];

    // Step 1: Create user in public.users
    const { error: userError } = await supabaseAdmin
      .from('users')
      .insert({ id: userId, email })
      .select();

    if (userError) {
      if (userError.code === '23505') { // Unique violation
        results.push({ step: 'create user', status: 'already exists' });
      } else {
        results.push({ step: 'create user', status: 'failed', error: userError.message });
      }
    } else {
      results.push({ step: 'create user', status: 'created' });
    }

    // Step 2: Create church
    const { data: churchData, error: churchError } = await supabaseAdmin
      .from('churches')
      .insert({ name: 'My Church' })
      .select()
      .single();

    if (churchError) {
      if (churchError.code === '23505') { // Might already exist, try to get it
        const { data: existingChurch } = await supabaseAdmin
          .from('church_members')
          .select('church_id')
          .eq('user_id', userId)
          .limit(1)
          .single();

        if (existingChurch) {
          results.push({ step: 'create church', status: 'already exists', church_id: existingChurch.church_id });
        } else {
          results.push({ step: 'create church', status: 'failed', error: churchError.message });
        }
      } else {
        results.push({ step: 'create church', status: 'failed', error: churchError.message });
        return NextResponse.json({ results, error: 'Failed to create church' }, { status: 500 });
      }
    } else {
      results.push({ step: 'create church', status: 'created', church_id: churchData.id });

      // Step 3: Link user to church as owner
      const { error: memberError } = await supabaseAdmin
        .from('church_members')
        .insert({
          church_id: churchData.id,
          user_id: userId,
          role: 'owner'
        });

      if (memberError) {
        if (memberError.code === '23505') {
          results.push({ step: 'link user to church', status: 'already linked' });
        } else {
          results.push({ step: 'link user to church', status: 'failed', error: memberError.message });
        }
      } else {
        results.push({ step: 'link user to church', status: 'linked' });
      }

      // Step 4: Create trial subscription
      const { error: subError } = await supabaseAdmin
        .from('subscriptions')
        .insert({
          church_id: churchData.id,
          plan: 'trial',
          status: 'trialing',
          trial_end: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString(),
          price_type: 'monthly'
        });

      if (subError) {
        if (subError.code === '23505') {
          results.push({ step: 'create subscription', status: 'already exists' });
        } else {
          results.push({ step: 'create subscription', status: 'failed', error: subError.message });
        }
      } else {
        results.push({ step: 'create subscription', status: 'created' });
      }
    }

    // Verification step
    const { data: verifyUser } = await supabaseAdmin
      .from('users')
      .select('id')
      .eq('id', userId)
      .single();

    const { data: verifyChurch } = await supabaseAdmin
      .from('church_members')
      .select('church_id, role')
      .eq('user_id', userId)
      .single();

    return NextResponse.json({
      success: true,
      results,
      verification: {
        user_exists: !!verifyUser,
        church_member: verifyChurch || null
      }
    });

  } catch (error: any) {
    console.error('Complete fix error:', error);
    return NextResponse.json(
      { error: error.message },
      { status: 500 }
    );
  }
}