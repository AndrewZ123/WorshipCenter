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
  formatSwapRole,
  getTeamMemberForUser,
  getUserSwapContext,
  isLeaderRole,
  loadAssignmentForSwap,
  loadChurchName,
  loadSwap,
  loadTeamMemberById,
  scheduleAfterResponse,
  sendSwapNotifications,
  toTeamMemberRecipient,
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
      `swaps-decline:${user.id}`,
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
    if (!context || !isLeaderRole(context.role)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const swap = await loadSwap(paramsResult.data.id, context.churchId);
    if (!swap) {
      return NextResponse.json({ error: 'Swap request not found' }, { status: 404 });
    }

    // A leader who made the request may only withdraw it through cancel.
    const member = await getTeamMemberForUser(user.id, context.churchId);
    if (member && swap.requested_by === member.id) {
      return NextResponse.json(
        { error: 'Cancel your own swap request instead' },
        { status: 403 }
      );
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
        status: 'declined',
        resolved_at: new Date().toISOString(),
        resolved_by: user.id,
      })
      .eq('id', swap.id)
      .eq('church_id', context.churchId)
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

    scheduleAfterResponse(async () => {
      const assignment = await loadAssignmentForSwap(swap.assignment_id);
      if (!assignment || assignment.service.church_id !== context.churchId) return;

      const requester = await loadTeamMemberById(swap.requested_by, context.churchId);
      const claimer = swap.claimed_by
        ? await loadTeamMemberById(swap.claimed_by, context.churchId)
        : null;
      const churchName = await loadChurchName(context.churchId);
      const recipients = [
        toTeamMemberRecipient(requester),
        toTeamMemberRecipient(claimer),
      ].filter((recipient): recipient is NonNullable<typeof recipient> => Boolean(recipient));

      await sendSwapNotifications(recipients, {
        churchId: context.churchId,
        churchName,
        serviceId: assignment.service_id,
        assignmentId: assignment.id,
        title: `Swap declined: ${formatSwapRole(assignment.role)}`,
        message: `The swap request for ${assignment.service.title} on ${assignment.service.date} was declined. The original assignment is unchanged.`,
        linkUrl: '/serve',
        emailHeadline: 'Your swap request was declined',
        emailMessage: 'The original assignment is unchanged. Please contact your worship leader if you need help covering it.',
        serviceTitle: assignment.service.title,
        serviceDate: assignment.service.date,
        serviceTime: assignment.service.time,
        role: assignment.role,
      });
    });

    return NextResponse.json({ swap: { id: swap.id, status: 'declined' } });
  } catch (error) {
    console.error('[Swaps] Decline error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
