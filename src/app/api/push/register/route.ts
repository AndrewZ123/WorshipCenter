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

    const { data: existing } = await supabaseAdmin
      .from('device_tokens')
      .select('id')
      .eq('token', token)
      .maybeSingle();

    if (existing) {
      await supabaseAdmin
        .from('device_tokens')
        .update({
          user_id: user.id,
          platform,
          is_active: true,
          updated_at: new Date().toISOString(),
        })
        .eq('id', existing.id);
    } else {
      await supabaseAdmin
        .from('device_tokens')
        .insert({
          user_id: user.id,
          token,
          platform,
          is_active: true,
        });
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
