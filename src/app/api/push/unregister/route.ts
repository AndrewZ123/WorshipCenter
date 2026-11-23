import { NextRequest, NextResponse } from 'next/server';
import { checkRateLimit, getRequestUser, rateLimitResponse } from '@/lib/auth-middleware';
import { requireActiveSubscription } from '@/lib/subscription-middleware';
import { supabaseAdmin } from '@/lib/supabase';
import { RateLimitTiers } from '@/lib/comprehensiveRateLimit';
import { PushUnregisterSchema, invalidInputResponse } from '@/lib/validation';

export async function POST(request: NextRequest) {
  try {
    const user = await getRequestUser(request);
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const limit = checkRateLimit(
      `push-unregister:${user.id}`,
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

    const parsedBody = PushUnregisterSchema.safeParse(rawBody);
    if (!parsedBody.success) {
      return invalidInputResponse();
    }

    const { token } = parsedBody.data;

    await supabaseAdmin
      .from('device_tokens')
      .update({ is_active: false, updated_at: new Date().toISOString() })
      .eq('token', token)
      .eq('user_id', user.id);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('[Push Unregister] Error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
