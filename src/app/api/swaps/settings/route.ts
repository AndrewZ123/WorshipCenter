import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import {
  checkRateLimit,
  getRequestUser,
  rateLimitResponse,
} from '@/lib/auth-middleware';
import { requireActiveSubscription } from '@/lib/subscription-middleware';
import { supabaseAdmin } from '@/lib/supabase';
import { RateLimitTiers } from '@/lib/comprehensiveRateLimit';
import {
  getUserSwapContext,
  isAutoApproveSwapsEnabled,
  isLeaderRole,
} from '@/lib/swaps/service';

const SettingsBodySchema = z.object({
  autoApproveSwaps: z.boolean(),
});

export async function GET(request: NextRequest) {
  try {
    const user = await getRequestUser(request);
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const limit = checkRateLimit(
      `swaps-settings-read:${user.id}`,
      RateLimitTiers.API_READ.requests,
      RateLimitTiers.API_READ.window
    );
    if (!limit.allowed) {
      return rateLimitResponse(limit);
    }

    const context = await getUserSwapContext(user.id);
    if (!context) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    return NextResponse.json({
      autoApproveSwaps: await isAutoApproveSwapsEnabled(context.churchId),
      canManage: isLeaderRole(context.role),
    });
  } catch (error) {
    console.error('[Swaps] Settings read error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const user = await getRequestUser(request);
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const limit = checkRateLimit(
      `swaps-settings-write:${user.id}`,
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

    const context = await getUserSwapContext(user.id);
    if (!context || !isLeaderRole(context.role)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    let rawBody: unknown;
    try {
      rawBody = await request.json();
    } catch {
      return NextResponse.json({ error: 'Invalid request' }, { status: 400 });
    }

    const parsed = SettingsBodySchema.safeParse(rawBody);
    if (!parsed.success) {
      return NextResponse.json({ error: 'Invalid request' }, { status: 400 });
    }

    const { error } = await supabaseAdmin.from('church_settings').upsert(
      {
        church_id: context.churchId,
        auto_approve_swaps: parsed.data.autoApproveSwaps,
      },
      { onConflict: 'church_id' }
    );

    if (error) {
      console.error('[Swaps] Settings update failed:', error);
      return NextResponse.json(
        { error: 'Failed to update settings' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      autoApproveSwaps: parsed.data.autoApproveSwaps,
    });
  } catch (error) {
    console.error('[Swaps] Settings write error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
