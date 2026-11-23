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
  getTeamMemberForUser,
  getUserSwapContext,
  loadSwap,
} from '@/lib/swaps/service';

const SwapParamsSchema = z.object({
  id: z.string().uuid('Invalid swap id'),
});

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getRequestUser(request);
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const limit = checkRateLimit(
      `swaps-cancel:${user.id}`,
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

    const paramsResult = SwapParamsSchema.safeParse(await params);
    if (!paramsResult.success) {
      return NextResponse.json({ error: 'Invalid request' }, { status: 400 });
    }

    const context = await getUserSwapContext(user.id);
    if (!context) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const member = await getTeamMemberForUser(user.id, context.churchId);
    if (!member) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const swap = await loadSwap(paramsResult.data.id, context.churchId);
    if (!swap) {
      return NextResponse.json({ error: 'Swap request not found' }, { status: 404 });
    }

    if (swap.requested_by !== member.id) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    if (swap.status !== 'open' && swap.status !== 'claimed') {
      return NextResponse.json(
        { error: 'This swap request is already resolved' },
        { status: 409 }
      );
    }

    const { data: updatedRows, error: updateError } = await supabaseAdmin
      .from('assignment_swap_requests')
      .update({
        status: 'cancelled',
        resolved_at: new Date().toISOString(),
        resolved_by: user.id,
      })
      .eq('id', swap.id)
      .eq('church_id', context.churchId)
      .eq('requested_by', member.id)
      .in('status', ['open', 'claimed'])
      .select('id');

    if (
      updateError ||
      !Array.isArray(updatedRows) ||
      updatedRows.length !== 1
    ) {
      return NextResponse.json(
        { error: 'This swap request is already resolved' },
        { status: 409 }
      );
    }

    return NextResponse.json({ swap: { id: swap.id, status: 'cancelled' } });
  } catch (error) {
    console.error('[Swaps] Cancel error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
