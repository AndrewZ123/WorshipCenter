import { NextRequest, NextResponse } from 'next/server';
import { checkRateLimit, getRequestUser, rateLimitResponse } from '@/lib/auth-middleware';
import { requireActiveSubscription } from '@/lib/subscription-middleware';
import { supabaseAdmin } from '@/lib/supabase';
import { RateLimitTiers } from '@/lib/comprehensiveRateLimit';
import { PushRegisterSchema, invalidInputResponse } from '@/lib/validation';

export async function POST(request: NextRequest) {
  try {
    const user = await getRequestUser(request);
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const limit = checkRateLimit(
      `push-register:${user.id}`,
      RateLimitTiers.API_WRITE.requests,
      RateLimitTiers.API_WRITE.window
    );
    if (!limit.allowed) {
      return rateLimitResponse(limit);
    }

    const subscriptionCheck = await requireActiveSubscription(request);
    if (subscriptionCheck !== true) {
      return subscriptionCheck;
    }

    let rawBody: unknown;
    try {
      rawBody = await request.json();
    } catch {
      return invalidInputResponse();
    }

    const parsedBody = PushRegisterSchema.safeParse(rawBody);
    if (!parsedBody.success) {
      return invalidInputResponse();
    }

    const { token, platform } = parsedBody.data;

    // A device token is globally unique. Upserting binds it to the caller and
    // re-activates it if this device previously signed out under another user.
    const { error: upsertError } = await supabaseAdmin
      .from('device_tokens')
      .upsert(
        {
          user_id: user.id,
          token,
          platform,
          is_active: true,
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'token' }
      );

    if (upsertError) {
      console.error('[Push Register] Failed to store device token:', upsertError.message);
      return NextResponse.json({ error: 'Failed to register device' }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('[Push Register] Error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
