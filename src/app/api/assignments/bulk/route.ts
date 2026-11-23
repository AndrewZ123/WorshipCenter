import { NextRequest, NextResponse } from 'next/server';
import { checkRateLimit, getRequestUser, rateLimitResponse } from '@/lib/auth-middleware';
import { requireActiveSubscription } from '@/lib/subscription-middleware';
import { supabaseAdmin } from '@/lib/supabase';
import { RateLimitTiers } from '@/lib/comprehensiveRateLimit';
import { sendAssignmentNotification } from '@/lib/notifications';
import { isPushConfigured, sendPushNotification } from '@/lib/push';
import { assignmentCreatedPush } from '@/lib/push-events';
import { sendEmail, isEmailConfigured } from '@/lib/email';
import { serviceInvitationEmail } from '@/lib/email-templates';
import { buildResponseUrls, createResponseToken } from '@/lib/assignment-response-tokens';
import { z } from 'zod';

const BulkAssignmentSchema = z.object({
  serviceId: z.string().uuid(),
  assignments: z
    .array(
      z.object({
        team_member_id: z.string().uuid(),
        role: z.string().min(1).max(100).optional().default('Team Member'),
      })
    )
    .min(1)
    .max(50),
});

export async function POST(req: NextRequest) {
  try {
    const user = await getRequestUser(req);
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const limit = checkRateLimit(
      `assignments-bulk:${user.id}`,
      RateLimitTiers.API_WRITE.requests,
      RateLimitTiers.API_WRITE.window
    );
    if (!limit.allowed) {
      return rateLimitResponse(limit);
    }

    // Expired trials must not keep using planning APIs.
    const subscriptionCheck = await requireActiveSubscription(req);
    if (subscriptionCheck !== true) {
      return subscriptionCheck;
    }

    const { data: userData } = await supabaseAdmin
      .from('users')
      .select('church_id, role')
      .eq('id', user.id)
      .single();

    if (!userData?.church_id) {
      return NextResponse.json({ error: 'No church context' }, { status: 400 });
    }

    if (userData.role === 'team') {
      return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 });
    }

    let body: unknown;
    try {
      body = await req.json();
    } catch {
      return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
    }

    const parsed = BulkAssignmentSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Validation failed', details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const { serviceId, assignments } = parsed.data;

    // Verify the service belongs to this church
    const { data: service } = await supabaseAdmin
      .from('services')
      .select('id, title, date, time')
      .eq('id', serviceId)
      .eq('church_id', userData.church_id)
      .single();

    if (!service) {
      return NextResponse.json({ error: 'Service not found' }, { status: 404 });
    }

    // Get church name
    const { data: church } = await supabaseAdmin
      .from('churches')
      .select('name')
      .eq('id', userData.church_id)
      .single();

    // Verify team members belong to this church
    const memberIds = assignments.map(a => a.team_member_id);
    const { data: members } = await supabaseAdmin
      .from('team_members')
      .select('id, user_id, name, email')
      .in('id', memberIds)
      .eq('church_id', userData.church_id);

    const validMemberIds = new Set((members || []).map(m => m.id));
    const validAssignments = assignments.filter(a => validMemberIds.has(a.team_member_id));

    if (!validAssignments.length) {
      return NextResponse.json({ error: 'No valid team members found' }, { status: 400 });
    }

    // Bulk insert
    const rows = validAssignments.map(a => ({
      service_id: serviceId,
      team_member_id: a.team_member_id,
      role: a.role,
      status: 'pending',
    }));

    const { data: created, error: insertError } = await supabaseAdmin
      .from('service_assignments')
      .insert(rows)
      .select();

    if (insertError || !created?.length) {
      console.error('[BulkAssignments] Insert error:', insertError);
      return NextResponse.json(
        { error: 'Failed to create assignments' },
        { status: 500 }
      );
    }

    // Send in-app notifications + email for each assignment
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL ||
      (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : 'http://localhost:3000');
    const emailConfigured = await isEmailConfigured();

    const memberMap = new Map((members || []).map(m => [m.id, m]));
    for (const assignment of created) {
      const member = memberMap.get(assignment.team_member_id);
      if (!member) continue;

      // In-app notification
      if (member.user_id) {
        sendAssignmentNotification({
          userId: member.user_id,
          serviceId,
          serviceName: service.title,
          role: assignment.role,
          serviceDate: service.date,
          organizationId: userData.church_id,
        }).catch((err) =>
          console.error('[BulkAssignments] notification error:', err)
        );

        // Push is a no-op unless PUSH_ENABLED and APNs are configured.
        if (isPushConfigured() && member.user_id !== user.id) {
          void sendPushNotification(
            member.user_id,
            assignmentCreatedPush({
              role: assignment.role,
              serviceTitle: service.title,
              serviceDate: service.date,
              serviceId,
            })
          ).catch(() => {
            // Push failures must never fail the assignment write.
          });
        }
      }

      // Email
      if (member.email && emailConfigured && church) {
        let acceptUrl = `${baseUrl}/api/assignments/${assignment.id}/confirm`;
        let declineUrl = `${baseUrl}/api/assignments/${assignment.id}/decline`;

        // Single-use tokenized links; fall back to legacy links if the token
        // table is unavailable so invitations still go out.
        try {
          const rawToken = await createResponseToken(
            assignment.id,
            userData.church_id,
            service.date
          );
          ({ confirmUrl: acceptUrl, declineUrl } = buildResponseUrls(rawToken));
        } catch (error) {
          console.error('[BulkAssignments] Response token creation failed:', error);
        }

        const { html, text } = serviceInvitationEmail({
          memberName: member.name || 'Team Member',
          churchName: church.name,
          serviceTitle: service.title,
          serviceDate: service.date,
          serviceTime: service.time || '',
          role: assignment.role,
          acceptUrl,
          declineUrl,
        });
        sendEmail({
          to: member.email,
          subject: `Service Invitation: ${service.title}`,
          html,
          text,
        }).catch((err) =>
          console.error('[BulkAssignments] email error:', err)
        );
      }
    }

    return NextResponse.json({ created: created.length, assignments: created });
  } catch (error) {
    console.error('[BulkAssignments] Error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}