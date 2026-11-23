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
import { approveSwapAssignment } from '@/lib/swaps/approval';
import {
  buildSwapEligibilityContext,
  candidateCanClaim,
  formatSwapRole,
  getTeamMemberForUser,
  getUserSwapContext,
  isAutoApproveSwapsEnabled,
  loadAssignmentForSwap,
  loadAssignmentsForServiceDate,
  loadBlockoutsForChurch,
  loadChurchLeaders,
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
      `swaps-claim:${user.id}`,
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

    if (swap.status !== 'open') {
      return NextResponse.json(
        { error: 'This swap request is no longer open' },
        { status: 409 }
      );
    }

    const assignment = await loadAssignmentForSwap(swap.assignment_id);
    if (
      !assignment ||
      assignment.service.church_id !== context.churchId ||
      assignment.team_member_id !== swap.requested_by
    ) {
      return NextResponse.json(
        { error: 'This swap request is no longer available' },
        { status: 409 }
      );
    }

    const blockouts = await loadBlockoutsForChurch(context.churchId);
    const sameDateAssignments = await loadAssignmentsForServiceDate(
      context.churchId,
      assignment.service.date.slice(0, 10)
    );
    const eligibility = buildSwapEligibilityContext(
      assignment,
      blockouts,
      sameDateAssignments
    );

    if (!candidateCanClaim(member, eligibility)) {
      return NextResponse.json(
        { error: 'You are not eligible to claim this swap' },
        { status: 403 }
      );
    }

    // Status guard + claimed_by guard make this the single winner in a race.
    const { data: claimedRows, error: claimError } = await supabaseAdmin
      .from('assignment_swap_requests')
      .update({ claimed_by: member.id, status: 'claimed' })
      .eq('id', swap.id)
      .eq('church_id', context.churchId)
      .eq('status', 'open')
      .is('claimed_by', null)
      .select('id');

    if (
      claimError ||
      !Array.isArray(claimedRows) ||
      claimedRows.length !== 1
    ) {
      return NextResponse.json(
        { error: 'This swap request was already claimed' },
        { status: 409 }
      );
    }

    const requester = await loadTeamMemberById(swap.requested_by, context.churchId);
    const leaders = await loadChurchLeaders(context.churchId);
    const churchName = await loadChurchName(context.churchId);
    const serviceLink = `/services/${assignment.service_id}?tab=schedule`;
    const autoApproved = await isAutoApproveSwapsEnabled(context.churchId);

    if (autoApproved) {
      const approved = await approveSwapAssignment(swap.id, context.churchId, null);
      if (!approved) {
        // Put the request back up for grabs rather than leaving it stuck.
        await supabaseAdmin
          .from('assignment_swap_requests')
          .update({ claimed_by: null, status: 'open' })
          .eq('id', swap.id)
          .eq('status', 'claimed')
          .eq('claimed_by', member.id);

        return NextResponse.json(
          { error: 'Failed to approve swap' },
          { status: 500 }
        );
      }

      const approvalRecipients = [
        toTeamMemberRecipient(requester),
        toTeamMemberRecipient(member),
      ].filter((recipient): recipient is NonNullable<typeof recipient> => Boolean(recipient));

      await sendSwapNotifications(approvalRecipients, {
        churchId: context.churchId,
        churchName,
        serviceId: assignment.service_id,
        assignmentId: assignment.id,
        title: `Swap approved: ${formatSwapRole(assignment.role)}`,
        message: `The swap for ${assignment.service.title} on ${assignment.service.date} was auto-approved. ${member.name} now holds the assignment.`,
        linkUrl: serviceLink,
        emailHeadline: 'Your swap was approved',
        emailMessage: `${member.name} has taken over this assignment. It is now confirmed.`,
        serviceTitle: assignment.service.title,
        serviceDate: assignment.service.date,
        serviceTime: assignment.service.time,
        role: assignment.role,
      });
    }

    const claimRecipients = [
      toTeamMemberRecipient(requester),
      ...leaders.map((leader) => ({
        userId: leader.id,
        name: leader.name,
        email: leader.email,
      })),
    ].filter((recipient): recipient is NonNullable<typeof recipient> => Boolean(recipient));

    await sendSwapNotifications(claimRecipients, {
      churchId: context.churchId,
      churchName,
      serviceId: assignment.service_id,
      assignmentId: assignment.id,
      title: `Swap claimed: ${formatSwapRole(assignment.role)}`,
      message: `${member.name} claimed the swap for ${assignment.service.title} on ${assignment.service.date}. ${autoApproved ? 'It was auto-approved.' : 'A leader still needs to approve it.'}`,
      linkUrl: serviceLink,
      emailHeadline: `${member.name} claimed your swap request`,
      emailMessage: autoApproved
        ? `${member.name} now holds this assignment. It is already confirmed.`
        : 'A leader will review and approve the change. You do not need to do anything else right now.',
      serviceTitle: assignment.service.title,
      serviceDate: assignment.service.date,
      serviceTime: assignment.service.time,
      role: assignment.role,
    });

    return NextResponse.json({
      swap: {
        id: swap.id,
        assignment_id: swap.assignment_id,
        status: autoApproved ? 'approved' : 'claimed',
        claimed_by: member.id,
      },
      auto_approved: autoApproved,
    });
  } catch (error) {
    console.error('[Swaps] Claim error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
