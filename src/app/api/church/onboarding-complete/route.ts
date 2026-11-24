import { NextRequest, NextResponse } from 'next/server';
import {
  checkRateLimit,
  getRequestUser,
  rateLimitResponse,
} from '@/lib/auth-middleware';
import { supabaseAdmin } from '@/lib/supabase';
import { RateLimitTiers } from '@/lib/comprehensiveRateLimit';

/**
 * Mark the caller's church onboarding as complete.
 *
 * The church and role come from the authenticated profile, never from the
 * request body, so an admin cannot mark another church as complete. This is
 * the same flag the setup wizard uses to stay closed on new devices.
 */
export async function POST(req: NextRequest) {
  try {
    const user = await getRequestUser(req);
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const limit = checkRateLimit(
      `church-onboarding-complete:${user.id}`,
      RateLimitTiers.API_WRITE.requests,
      RateLimitTiers.API_WRITE.window
    );
    if (!limit.allowed) {
      return rateLimitResponse(limit);
    }

    const { data: profile, error: profileError } = await supabaseAdmin
      .from('users')
      .select('church_id, role')
      .eq('id', user.id)
      .single();

    if (profileError || !profile?.church_id) {
      return NextResponse.json({ error: 'No church context' }, { status: 400 });
    }

    if (profile.role !== 'admin') {
      return NextResponse.json({ error: 'Admin only' }, { status: 403 });
    }

    const completedAt = new Date().toISOString();
    const { data, error } = await supabaseAdmin
      .from('churches')
      .update({ onboarding_completed_at: completedAt })
      .eq('id', profile.church_id)
      .select('id, onboarding_completed_at')
      .single();

    if (error || !data) {
      console.error('[ChurchOnboarding] Failed to save completion:', error);
      return NextResponse.json(
        { error: 'Failed to save onboarding status' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      church_id: data.id,
      onboarding_completed_at: data.onboarding_completed_at,
    });
  } catch (error) {
    console.error('[ChurchOnboarding] POST error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
