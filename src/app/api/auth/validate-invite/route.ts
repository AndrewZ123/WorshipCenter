import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin, isSupabaseAdminConfigured } from '@/lib/supabase';
import { checkRateLimit, getClientIp, rateLimitResponse } from '@/lib/auth-middleware';
import { RateLimitTiers } from '@/lib/comprehensiveRateLimit';

/**
 * POST /api/auth/validate-invite
 *
 * Public (rate-limited) check that an invite link is valid.
 * Uses the service-role client so /join keeps working after churches
 * and team_members are no longer readable by the anon role.
 * Returns only the church and member display names, never the full roster.
 */
export async function POST(request: NextRequest) {
  try {
    const limit = checkRateLimit(
      `auth-validate-invite:${getClientIp(request)}`,
      RateLimitTiers.SIGNUP.requests,
      RateLimitTiers.SIGNUP.window
    );
    if (!limit.allowed) {
      return rateLimitResponse(limit);
    }

    if (!isSupabaseAdminConfigured()) {
      return NextResponse.json({ valid: false, error: 'Server is not configured.' }, { status: 500 });
    }

    const body = await request.json();
    const email = typeof body.email === 'string' ? body.email.trim() : '';
    const churchId = typeof body.churchId === 'string' ? body.churchId.trim() : '';

    if (!email || !churchId) {
      return NextResponse.json(
        { valid: false, error: 'Invalid invitation link. Missing parameters.' },
        { status: 400 }
      );
    }

    const { data: church, error: churchError } = await supabaseAdmin
      .from('churches')
      .select('id, name')
      .eq('id', churchId)
      .is('deleted_at', null)
      .maybeSingle();

    if (churchError || !church) {
      return NextResponse.json(
        { valid: false, error: 'Invalid invitation link. Church not found.' },
        { status: 404 }
      );
    }

    const { data: members, error: memberError } = await supabaseAdmin
      .from('team_members')
      .select('id, name, email')
      .eq('church_id', churchId)
      .ilike('email', email)
      .limit(1);

    if (memberError || !members || members.length === 0) {
      return NextResponse.json(
        { valid: false, error: 'No team member profile found for this invitation. Ask your worship leader for a new invite.' },
        { status: 404 }
      );
    }

    const { data: existingUser } = await supabaseAdmin
      .from('users')
      .select('id')
      .ilike('email', email)
      .maybeSingle();

    if (existingUser) {
      return NextResponse.json(
        { valid: false, error: 'An account already exists for this email. Please log in instead.' },
        { status: 409 }
      );
    }

    return NextResponse.json({
      valid: true,
      churchName: church.name,
      memberName: members[0].name,
    });
  } catch (err) {
    console.error('[ValidateInvite] Unexpected error:', err);
    return NextResponse.json({ valid: false, error: 'Internal server error' }, { status: 500 });
  }
}
