import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { checkRateLimit, getClientIp, rateLimitResponse } from '@/lib/auth-middleware';
import { RateLimitTiers } from '@/lib/comprehensiveRateLimit';
import { SignupAccountSchema, invalidInputResponse } from '@/lib/validation';

export async function POST(request: NextRequest) {
  try {
    // Public endpoint — rate limit by client IP to prevent church-creation abuse.
    const limit = checkRateLimit(
      `auth-signup:${getClientIp(request)}`,
      RateLimitTiers.SIGNUP.requests,
      RateLimitTiers.SIGNUP.window
    );
    if (!limit.allowed) {
      return rateLimitResponse(limit);
    }

    // Signup creates rows with the service role, so the profile must be bound
    // to the caller's verified JWT rather than an `authUserId` from the body.
    const authHeader = request.headers.get('authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const token = authHeader.slice('Bearer '.length).trim();
    if (!token) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { data: { user: authUser }, error: authError } = await supabaseAdmin.auth.getUser(token);
    if (authError || !authUser) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return invalidInputResponse();
    }

    const parsed = SignupAccountSchema.safeParse(body);
    if (!parsed.success) {
      return invalidInputResponse();
    }

    const { churchName, userName, email, authUserId } = parsed.data;

    // Never create a church/profile for a different auth user than the caller.
    if (authUserId && authUserId !== authUser.id) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 });
    }

    const tokenEmail = authUser.email?.toLowerCase();
    if (!tokenEmail) {
      return NextResponse.json({ error: 'Account has no email address' }, { status: 400 });
    }

    if (email && email !== tokenEmail) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 });
    }

    const profileUserId = authUser.id;
    const profileEmail = tokenEmail;

    // 1. If this auth user already has a profile, the church was created by an
    //    earlier request (signup retry, login completion, or a double submit).
    //    Return it instead of creating a second church.
    const { data: existingProfile, error: existingProfileError } = await supabaseAdmin
      .from('users')
      .select('church_id')
      .eq('id', profileUserId)
      .maybeSingle();

    if (existingProfileError) {
      console.error('[Signup API] Existing profile lookup error:', existingProfileError.message);
      return NextResponse.json(
        { error: 'Could not load your existing church account.' },
        { status: 500 }
      );
    }

    if (existingProfile) {
      if (existingProfile.church_id) {
        return NextResponse.json({
          success: true,
          church_id: existingProfile.church_id,
        });
      }

      // A profile without a church cannot be repaired safely here; never create
      // a second church for an auth user that already has a profile row.
      console.error('[Signup API] Existing profile has no church_id:', profileUserId);
      return NextResponse.json(
        { error: 'Your church account is incomplete. Please contact support.' },
        { status: 500 }
      );
    }

    // 2. Create the church (churches table only has id, name, created_at)
    const { data: churchData, error: churchError } = await supabaseAdmin
      .from('churches')
      .insert({ name: churchName })
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
        id: profileUserId,
        church_id: churchId,
        name: userName,
        email: profileEmail,
        role: 'admin',
      });

    if (userError) {
      console.error('[Signup API] User profile creation error:', userError.message);

      // A concurrent request may have created the profile between our lookup
      // and insert. Drop the church this request created and return the winner.
      const isDuplicate =
        userError.code === '23505' || /duplicate key/i.test(userError.message ?? '');
      if (isDuplicate) {
        // Drop the church and subscription this request created before
        // returning the profile/church the winning request persisted.
        await supabaseAdmin.from('subscriptions').delete().eq('church_id', churchId);
        await supabaseAdmin.from('churches').delete().eq('id', churchId);
        const { data: racedProfile } = await supabaseAdmin
          .from('users')
          .select('church_id')
          .eq('id', profileUserId)
          .maybeSingle();

        if (racedProfile?.church_id) {
          return NextResponse.json({
            success: true,
            church_id: racedProfile.church_id,
          });
        }
      }

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
        email: profileEmail,
        phone: '',
        roles: ['Worship Leader'],
        user_id: profileUserId,
      });

    if (teamMemberError) {
      console.error('[Signup API] Team member creation error:', teamMemberError.message);
      // Clean up the church and user profile we just created
      await supabaseAdmin.from('users').delete().eq('id', profileUserId);
      await supabaseAdmin.from('churches').delete().eq('id', churchId);
      return NextResponse.json(
        { error: `Failed to create team member: ${teamMemberError.message}` },
        { status: 500 }
      );
    }

    console.log('[Signup API] Success! Church created:', churchId);

    return NextResponse.json({
      success: true,
      church_id: churchId,
    });
  } catch (err) {
    console.error('[Signup API] Unexpected error:', err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Internal server error' },
      { status: 500 }
    );
  }
}