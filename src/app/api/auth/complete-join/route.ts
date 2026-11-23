import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { supabaseAdmin, isSupabaseAdminConfigured } from '@/lib/supabase';
import { checkRateLimit, getClientIp, rateLimitResponse } from '@/lib/auth-middleware';
import { RateLimitTiers } from '@/lib/comprehensiveRateLimit';

/**
 * POST /api/auth/complete-join
 *
 * After the invitee creates an auth user, attach their profile to the
 * invited church. Uses the service-role client because the new user has
 * no public.users row yet, so church-scoped RLS cannot see team_members.
 */
export async function POST(request: NextRequest) {
  try {
    const limit = checkRateLimit(
      `auth-complete-join:${getClientIp(request)}`,
      RateLimitTiers.SIGNUP.requests,
      RateLimitTiers.SIGNUP.window
    );
    if (!limit.allowed) {
      return rateLimitResponse(limit);
    }

    if (!isSupabaseAdminConfigured()) {
      return NextResponse.json({ error: 'Server is not configured.' }, { status: 500 });
    }

    const authHeader = request.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const token = authHeader.slice(7);
    const supabaseClient = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL || '',
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '',
      { global: { headers: { Authorization: `Bearer ${token}` } } }
    );

    const { data: { user: authUser }, error: authError } = await supabaseClient.auth.getUser();
    if (authError || !authUser) {
      return NextResponse.json({ error: 'Authentication failed' }, { status: 401 });
    }

    const body = await request.json();
    const churchId = typeof body.churchId === 'string' ? body.churchId.trim() : '';
    if (!churchId) {
      return NextResponse.json({ error: 'Missing churchId' }, { status: 400 });
    }

    const email = authUser.email;
    if (!email) {
      return NextResponse.json({ error: 'Account has no email address' }, { status: 400 });
    }

    const { data: members, error: memberError } = await supabaseAdmin
      .from('team_members')
      .select('id, name, email, user_id')
      .eq('church_id', churchId)
      .ilike('email', email)
      .limit(1);

    if (memberError || !members || members.length === 0) {
      return NextResponse.json({ error: 'No team member invitation found' }, { status: 403 });
    }

    const member = members[0];

    const { data: existing } = await supabaseAdmin
      .from('users')
      .select('id, church_id')
      .eq('id', authUser.id)
      .maybeSingle();

    if (existing) {
      if (existing.church_id !== churchId) {
        return NextResponse.json({ error: 'Account already belongs to another church' }, { status: 409 });
      }
    } else {
      const { error: profileError } = await supabaseAdmin
        .from('users')
        .insert({
          id: authUser.id,
          church_id: churchId,
          name: member.name,
          email: member.email || email,
          role: 'team',
        });

      if (profileError) {
        console.error('[CompleteJoin] Profile create error:', profileError.message);
        return NextResponse.json({ error: 'Failed to create user profile' }, { status: 500 });
      }
    }

    if (!member.user_id) {
      const { error: linkError } = await supabaseAdmin
        .from('team_members')
        .update({ user_id: authUser.id })
        .eq('id', member.id)
        .eq('church_id', churchId);

      if (linkError) {
        console.warn('[CompleteJoin] Failed to link team member:', linkError.message);
      }
    }

    return NextResponse.json({ success: true, churchId });
  } catch (err) {
    console.error('[CompleteJoin] Unexpected error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
