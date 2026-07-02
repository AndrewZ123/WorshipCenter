import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { db } from '@/lib/store';
import { sendEmail, isEmailConfigured } from '@/lib/email';
import { assignmentDeclinedEmail } from '@/lib/email-templates';
import type { ServiceAssignment } from '@/lib/types';

const appUrl = process.env.NEXT_PUBLIC_APP_URL ||
  (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : 'http://localhost:3000');

async function declineAssignment(assignmentId: string, churchId: string) {
  const assignment = await db.assignments.getById(assignmentId, churchId);
  if (!assignment) return null;

  const teamMember = await db.teamMembers.getById(assignment.team_member_id, churchId);
  if (!teamMember) return null;

  const declinedAssignment = await db.assignments.decline(assignmentId, churchId);
  if (!declinedAssignment) return null;

  const service = await db.services.getById(assignment.service_id, churchId);
  if (service) {
    const church = await db.churches.getById(churchId);
    if (church && (await isEmailConfigured())) {
      const leaders = await db.teamMembers.getByChurch(churchId);
      const adminLeaders = leaders.filter(tm =>
        tm.roles.includes('admin') || tm.roles.includes('leader')
      );
      const { html, text } = assignmentDeclinedEmail({
        churchName: church.name,
        serviceTitle: service.title,
        memberName: teamMember.name,
        role: assignment.role,
      });
      for (const leader of adminLeaders) {
        if (!leader.email) continue;
        await sendEmail({
          to: leader.email,
          subject: `${teamMember.name} declined ${service.title}`,
          html,
          text,
        });
      }
    }
  }

  return declinedAssignment;
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ assignmentId: string }> }
) {
  const { assignmentId } = await params;
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    const loginUrl = new URL('/login', appUrl);
    loginUrl.searchParams.set('redirect', `/api/assignments/${assignmentId}/decline`);
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

  await declineAssignment(assignmentId, userData.church_id);

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

    const declinedAssignment = await declineAssignment(assignmentId, userData.church_id);
    if (!declinedAssignment) {
      return NextResponse.json({ error: 'Failed to decline assignment' }, { status: 500 });
    }

    return NextResponse.json({ assignment: declinedAssignment });
  } catch (error) {
    console.error('[Assignment Decline] Error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}