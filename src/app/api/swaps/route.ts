import { randomUUID } from 'node:crypto';
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
import type {
  AssignmentSwapStatus,
  AssignmentSwapSummary,
} from '@/lib/types';
import {
  buildSwapEligibilityContext,
  candidateCanClaim,
  formatSwapRole,
  getTeamMemberForUser,
  getUserSwapContext,
  isLeaderRole,
  isServiceInFuture,
  loadAssignmentForSwap,
  loadAssignmentsForServiceDate,
  loadBlockoutsForChurch,
  loadChurchName,
  loadChurchTeamMembers,
  loadTeamMemberById,
  MAX_SWAP_NOTIFY_RECIPIENTS,
  scheduleAfterResponse,
  sendSwapNotifications,
  SWAP_NOTE_MAX_LENGTH,
  toTeamMemberRecipient,
  type SwapRow,
} from '@/lib/swaps/service';

const CreateSwapSchema = z.object({
  assignmentId: z.string().uuid('Invalid assignment id'),
  note: z
    .string()
    .max(SWAP_NOTE_MAX_LENGTH, `Note must be ${SWAP_NOTE_MAX_LENGTH} characters or fewer`)
    .optional(),
});

const ALL_STATUSES: AssignmentSwapStatus[] = [
  'open',
  'claimed',
  'approved',
  'declined',
  'cancelled',
];

function parseStatuses(raw: string | null): AssignmentSwapStatus[] | null {
  switch (raw || 'open') {
    case 'open':
      return ['open'];
    case 'claimed':
      return ['claimed'];
    case 'pending':
      return ['open', 'claimed'];
    case 'mine':
      return [];
    case 'all':
      return ALL_STATUSES;
    default:
      return null;
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = await getRequestUser(request);
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const limit = checkRateLimit(
      `swaps-create:${user.id}`,
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
      return NextResponse.json({ error: 'Invalid request' }, { status: 400 });
    }

    const parsed = CreateSwapSchema.safeParse(rawBody);
    if (!parsed.success) {
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

    const assignment = await loadAssignmentForSwap(parsed.data.assignmentId);
    if (!assignment || assignment.service.church_id !== context.churchId) {
      return NextResponse.json({ error: 'Assignment not found' }, { status: 404 });
    }

    // Only the volunteer who owns the assignment can offer it for a swap.
    if (assignment.team_member_id !== member.id) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    if (!isServiceInFuture(assignment.service.date, assignment.service.time)) {
      return NextResponse.json(
        { error: 'This service is not upcoming' },
        { status: 400 }
      );
    }

    const { data: existing } = await supabaseAdmin
      .from('assignment_swap_requests')
      .select('id')
      .eq('assignment_id', assignment.id)
      .eq('church_id', context.churchId)
      .in('status', ['open', 'claimed'])
      .maybeSingle();

    if (existing) {
      return NextResponse.json(
        { error: 'This assignment already has an active swap request' },
        { status: 409 }
      );
    }

    const note = parsed.data.note?.trim() || null;
    const swapId = randomUUID();

    const { error: insertError } = await supabaseAdmin
      .from('assignment_swap_requests')
      .insert({
        id: swapId,
        church_id: context.churchId,
        assignment_id: assignment.id,
        requested_by: member.id,
        claimed_by: null,
        status: 'open',
        note,
      });

    if (insertError) {
      // The partial unique index is the final guard against two requests
      // opening at the same instant.
      if (insertError.code === '23505') {
        return NextResponse.json(
          { error: 'This assignment already has an active swap request' },
          { status: 409 }
        );
      }
      console.error('[Swaps] Failed to create request:', insertError);
      return NextResponse.json(
        { error: 'Failed to create swap request' },
        { status: 500 }
      );
    }

    // Notify qualified teammates after responding. Notification work (and its
    // eligibility reads) must never delay the request the volunteer just made.
    const requestedBy = member;
    scheduleAfterResponse(async () => {
      const candidates = await loadChurchTeamMembers(context.churchId);
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
      const qualified = candidates
        .filter(
          (candidate) =>
            candidate.id !== requestedBy.id &&
            Boolean(candidate.user_id || candidate.email) &&
            candidateCanClaim(candidate, eligibility)
        )
        .slice(0, MAX_SWAP_NOTIFY_RECIPIENTS);

      if (qualified.length === 0) return;

      const churchName = await loadChurchName(context.churchId);
      const recipients = qualified
        .map(toTeamMemberRecipient)
        .filter((recipient): recipient is NonNullable<typeof recipient> => Boolean(recipient));

      await sendSwapNotifications(recipients, {
        churchId: context.churchId,
        churchName,
        serviceId: assignment.service_id,
        assignmentId: assignment.id,
        title: `Swap requested: ${formatSwapRole(assignment.role)}`,
        message: `${requestedBy.name} is looking for someone to cover ${formatSwapRole(assignment.role)} for ${assignment.service.title} on ${assignment.service.date}.`,
        linkUrl: '/serve',
        emailHeadline: `${requestedBy.name} is looking for a swap`,
        emailMessage: `${requestedBy.name} has asked the team to cover their ${formatSwapRole(assignment.role)} role. If you are available, open WorshipCenter to claim it.`,
        serviceTitle: assignment.service.title,
        serviceDate: assignment.service.date,
        serviceTime: assignment.service.time,
        role: assignment.role,
      });
    });

    return NextResponse.json(
      {
        swap: {
          id: swapId,
          assignment_id: assignment.id,
          status: 'open',
          note,
        },
      },
      { status: 201 }
    );
  } catch (error) {
    console.error('[Swaps] Create error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function GET(request: NextRequest) {
  try {
    const user = await getRequestUser(request);
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const limit = checkRateLimit(
      `swaps-list:${user.id}`,
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

    const statusParam = request.nextUrl.searchParams.get('status');
    const statuses = parseStatuses(statusParam);
    if (!statuses) {
      return NextResponse.json({ error: 'Invalid status' }, { status: 400 });
    }

    const serviceId = request.nextUrl.searchParams.get('serviceId');
    if (serviceId && !z.string().uuid().safeParse(serviceId).success) {
      return NextResponse.json({ error: 'Invalid service id' }, { status: 400 });
    }

    const member = await getTeamMemberForUser(user.id, context.churchId);
    const isLeader = isLeaderRole(context.role);

    let query = supabaseAdmin
      .from('assignment_swap_requests')
      .select(
        'id, church_id, assignment_id, requested_by, claimed_by, status, note, created_at, updated_at, resolved_at, resolved_by'
      )
      .eq('church_id', context.churchId)
      .order('created_at', { ascending: false });

    if (statuses.length > 0) {
      query = query.in('status', statuses);
    }

    const { data, error } = await query;
    if (error) {
      console.error('[Swaps] List failed:', error);
      return NextResponse.json({ error: 'Failed to load swaps' }, { status: 500 });
    }

    const swaps = (Array.isArray(data) ? data : []) as SwapRow[];
    const blockouts = await loadBlockoutsForChurch(context.churchId);
    const assignmentsByDate = new Map<
      string,
      Awaited<ReturnType<typeof loadAssignmentsForServiceDate>>
    >();
    const membersById = new Map<string, Awaited<ReturnType<typeof loadTeamMemberById>>>();
    const summaries: AssignmentSwapSummary[] = [];

    for (const swap of swaps) {
      const assignment = await loadAssignmentForSwap(swap.assignment_id);
      if (!assignment || assignment.service.church_id !== context.churchId) continue;
      if (serviceId && assignment.service_id !== serviceId) continue;

      const serviceDate = assignment.service.date.slice(0, 10);
      if (!assignmentsByDate.has(serviceDate)) {
        assignmentsByDate.set(
          serviceDate,
          await loadAssignmentsForServiceDate(context.churchId, serviceDate)
        );
      }

      const eligibility = buildSwapEligibilityContext(
        assignment,
        blockouts,
        assignmentsByDate.get(serviceDate) || []
      );

      const isMine = Boolean(member && swap.requested_by === member.id);
      const isClaimedByMe = Boolean(member && swap.claimed_by === member.id);
      const canClaim = Boolean(
        member &&
          swap.status === 'open' &&
          !isMine &&
          candidateCanClaim(member, eligibility)
      );

      // A service-scoped pending list powers the Team tab's swap counter and
      // drawer. It shows every live request on that service (any requester),
      // while claim/approve permissions still come from can_claim/isLeader.
      const isServicePending =
        Boolean(serviceId) && (swap.status === 'open' || swap.status === 'claimed');
      const include =
        statusParam === 'mine'
          ? isMine || isClaimedByMe
          : isServicePending || isMine || isClaimedByMe || canClaim || isLeader;
      if (!include) continue;

      if (!membersById.has(swap.requested_by)) {
        membersById.set(
          swap.requested_by,
          await loadTeamMemberById(swap.requested_by, context.churchId)
        );
      }
      const requester = membersById.get(swap.requested_by);

      let claimer = null;
      if (swap.claimed_by) {
        if (!membersById.has(swap.claimed_by)) {
          membersById.set(
            swap.claimed_by,
            await loadTeamMemberById(swap.claimed_by, context.churchId)
          );
        }
        const claimedMember = membersById.get(swap.claimed_by);
        if (claimedMember) {
          claimer = {
            id: claimedMember.id,
            name: claimedMember.name,
            avatar_url: claimedMember.avatar_url,
          };
        }
      }

      summaries.push({
        id: swap.id,
        assignment_id: swap.assignment_id,
        status: swap.status,
        note: swap.note,
        created_at: swap.created_at,
        resolved_at: swap.resolved_at,
        role: assignment.role,
        service: {
          id: assignment.service.id,
          title: assignment.service.title,
          date: assignment.service.date,
          time: assignment.service.time,
        },
        requester: {
          id: swap.requested_by,
          name: requester?.name || 'Team member',
          avatar_url: requester?.avatar_url || null,
        },
        claimed_by: claimer,
        can_claim: canClaim,
        is_mine: isMine,
      });
    }

    return NextResponse.json({ swaps: summaries });
  } catch (error) {
    console.error('[Swaps] List error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
