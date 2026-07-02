import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { db } from '@/lib/store';
import { sendEmail, isEmailConfigured } from '@/lib/email';
import { assignmentConfirmedEmail } from '@/lib/email-templates';
import { sendConfirmationNotification } from '@/lib/notifications';
import type { ServiceAssignment } from '@/lib/types';

const appUrl = process.env.NEXT_PUBLIC_APP_URL ||
  (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : 'http://localhost:3000');

async function confirmAssignment(assignmentId: string, churchId: string) {
  const assignment = await db.assignments.getById(assignmentId, churchId);
  if (!assignment) return null;

  const teamMember = await db.teamMembers.getById(assignment.team_member_id, churchId);
  if (!teamMember) return null;

  const confirmedAssignment = await db.assignments.confirm(assignmentId, churchId);
  if (!confirmedAssignment) return null;

  const service = await db.services.getById(assignment.service_id, churchId);
  if (service) {
    const teamMembers = await db.teamMembers.getByChurch(churchId);
    const leaders = teamMembers.filter(tm =>
      tm.roles.includes('admin') || tm.roles.includes('leader')
    );
    for (const leader of leaders) {
      if (!leader.user_id || leader.user_id === (teamMember.user_id || '')) continue;
      await sendConfirmationNotification({
        leaderId: leader.user_id,
        serviceId: service.id,
        serviceName: service.title,
        userName: teamMember.name,
        role: assignment.role,
        serviceDate: service.date,
        organizationId: churchId,
      });
    }

    const church = await db.churches.getById(churchId);
    if (church && (await isEmailConfigured())) {
      const { html, text } = assignmentConfirmedEmail({
        memberName: teamMember.name,
        churchName: church.name,
        serviceTitle: service.title,
        serviceDate: service.date,
        serviceTime: service.time,
        role: assignment.role,
      });
      await sendEmail({
        to: teamMember.email,
        subject: `Confirmed: ${service.title}`,
        html,
        text,
      });
    }
  }

  return confirmedAssignment;
}

/**
 * GET — one-click confirm from email link.
 * Uses session cookie for auth. If not logged in, redirects to login then back.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ assignmentId: string }> }
) {
  const { assignmentId } = await params;
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    const loginUrl = new URL('/login', appUrl);
    loginUrl.searchParams.set('redirect', `/api/assignments/${assignmentId}/confirm`);
    return NextResponse.redirect(loginUrl);
  }

  const { data: userData } = await supabase
    .from('users')
    .select('church_id')
    .eq('id', user.id)
    .single();

  if (!userData) return NextResponse.redirect(new URL('/dashboard', appUrl));

  const assignment = await db.assignments.getById(assignmentId, userData.church_id);
  if (!assignment) return NextResponse.redirect(new URL('/dashboard', appUrl));

  const teamMember = await db.teamMembers.getById(assignment.team_member_id, userData.church_id);
  if (!teamMember || teamMember.user_id !== user.id) return NextResponse.redirect(new URL('/dashboard', appUrl));

  await confirmAssignment(assignmentId, userData.church_id);

  const service = await db.services.getById(assignment.service_id, userData.church_id);
  return NextResponse.redirect(new URL(`/services/${service?.id || ''}`, appUrl));
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ assignmentId: string }> }
) {
  try {
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { assignmentId } = await params;

    const { data: userData } = await supabase
      .from('users')
      .select('church_id')
      .eq('id', user.id)
      .single();

    if (!userData) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    const assignment = await db.assignments.getById(assignmentId, userData.church_id);
    if (!assignment) {
      return NextResponse.json({ error: 'Assignment not found' }, { status: 404 });
    }

    const teamMember = await db.teamMembers.getById(assignment.team_member_id, userData.church_id);
    if (!teamMember || teamMember.user_id !== user.id) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const confirmedAssignment = await confirmAssignment(assignmentId, userData.church_id);
    if (!confirmedAssignment) {
      return NextResponse.json({ error: 'Failed to confirm assignment' }, { status: 500 });
    }

    return NextResponse.json({ assignment: confirmedAssignment });
  } catch (error) {
    console.error('[Assignment Confirm] Error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}