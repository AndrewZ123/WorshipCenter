import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import {
  checkRateLimit,
  getRequestUser,
  rateLimitResponse,
} from '@/lib/auth-middleware';
import { requireActiveSubscription } from '@/lib/subscription-middleware';
import { RateLimitTiers } from '@/lib/comprehensiveRateLimit';
import { approveSwapAssignment } from '@/lib/swaps/approval';
import {
  formatSwapRole,
  getUserSwapContext,
  isLeaderRole,
  loadAssignmentForSwap,
  loadChurchName,
  loadSwap,
  loadTeamMemberById,
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
      `swaps-approve:${user.id}`,
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

    if (swap.status !== 'claimed' || !swap.claimed_by) {
      return NextResponse.json(
        { error: 'This swap request is not awaiting approval' },
        { status: 409 }
      );
    }

    const assignment = await loadAssignmentForSwap(swap.assignment_id);
    if (!assignment || assignment.service.church_id !== context.churchId) {
      return NextResponse.json({ error: 'Assignment not found' }, { status: 404 });
    }

    const approved = await approveSwapAssignment(swap.id, context.churchId, user.id);
    if (!approved) {
      return NextResponse.json(
        { error: 'This swap request could not be approved' },
        { status: 409 }
      );
    }

    const requester = await loadTeamMemberById(swap.requested_by, context.churchId);
    const claimer = await loadTeamMemberById(swap.claimed_by, context.churchId);
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
      title: `Swap approved: ${formatSwapRole(assignment.role)}`,
      message: `The swap for ${assignment.service.title} on ${assignment.service.date} was approved. ${claimer?.name || 'The claimer'} now holds this assignment.`,
      linkUrl: `/services/${assignment.service_id}?tab=schedule`,
      emailHeadline: 'Your swap was approved',
      emailMessage: `${claimer?.name || 'The claimer'} has taken over this assignment. It is now confirmed.`,
      serviceTitle: assignment.service.title,
      serviceDate: assignment.service.date,
      serviceTime: assignment.service.time,
      role: assignment.role,
    });

    return NextResponse.json({
      swap: { id: swap.id, status: 'approved', claimed_by: swap.claimed_by },
    });
  } catch (error) {
    console.error('[Swaps] Approve error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
