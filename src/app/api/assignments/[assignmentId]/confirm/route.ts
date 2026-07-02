import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { db } from '@/lib/store';
import { sendEmail, isEmailConfigured } from '@/lib/email';
import { assignmentConfirmedEmail } from '@/lib/email-templates';
import { sendConfirmationNotification } from '@/lib/notifications';

const appUrl = process.env.NEXT_PUBLIC_APP_URL ||
  (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : 'http://localhost:3000');

function resultPage(title: string, heading: string, message: string, dashboardLink?: string) {
  const link = dashboardLink || `${appUrl}/dashboard`;
  return new Response(
    `<!DOCTYPE html>
<html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1.0">
<title>${title}</title>
<style>
body{margin:0;padding:32px 16px;background:#F9FAFB;font-family:Inter,-apple-system,sans-serif;display:flex;align-items:center;justify-content:center;min-height:100vh}
.card{max-width:440px;width:100%;background:#fff;border-radius:12px;border:1px solid #E5E7EB;padding:32px;text-align:center;box-shadow:0 4px 12px rgba(0,0,0,0.08)}
.icon{font-size:48px;margin-bottom:16px}
h1{font-size:22px;font-weight:700;color:#1F2937;margin:0 0 8px;letter-spacing:-0.02em}
p{font-size:15px;line-height:1.7;color:#4B5563;margin:0 0 24px}
a{display:inline-block;background:#0D9488;color:#fff!important;text-decoration:none;padding:12px 28px;border-radius:8px;font-weight:600;font-size:15px;margin:4px}
a.secondary{background:#fff;color:#0D9488!important;border:1px solid #0D9488}
</style></head><body>
<div class="card">
<div class="icon">${heading.includes('Confirmed') ? '✅' : heading.includes('Declined') ? '❌' : '📋'}</div>
<h1>${heading}</h1>
<p>${message}</p>
<a href="${link}">Go to Dashboard</a>
</div></body></html>`,
    { headers: { 'Content-Type': 'text/html;charset=utf-8' } }
  );
}

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

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ assignmentId: string }> }
) {
  const { assignmentId } = await params;
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return resultPage(
      'Confirm Attendance',
      'You need to log in first',
      'Please log in to confirm your attendance.',
      `${appUrl}/login?redirect=/api/assignments/${assignmentId}/confirm`
    );
  }

  const { data: userData } = await supabase
    .from('users')
    .select('church_id')
    .eq('id', user.id)
    .single();

  if (!userData) {
    return resultPage('Error', 'Account not found', 'Could not find your account. Please contact your administrator.');
  }

  const assignment = await db.assignments.getById(assignmentId, userData.church_id);
  if (!assignment) {
    return resultPage('Not Found', 'Assignment not found', 'This assignment may have been removed. Contact your worship leader.');
  }

  const teamMember = await db.teamMembers.getById(assignment.team_member_id, userData.church_id);
  if (!teamMember || teamMember.user_id !== user.id) {
    return resultPage('Access Denied', 'Not your assignment', 'This confirmation link belongs to a different team member.');
  }

  const confirmedAssignment = await confirmAssignment(assignmentId, userData.church_id);
  if (!confirmedAssignment) {
    return resultPage('Error', 'Failed to confirm', 'Something went wrong. Please try again or contact your worship leader.');
  }

  const service = await db.services.getById(assignment.service_id, userData.church_id);
  return resultPage(
    'Confirmed!',
    'You\'re Confirmed! ✅',
    `You've confirmed for ${service?.title || 'the service'}. Thanks for serving!`,
    `${appUrl}/services/${service?.id || ''}`
  );
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ assignmentId: string }> }
) {
  try {
    let user;
    const authHeader = request.headers.get('Authorization');
    if (authHeader?.startsWith('Bearer ')) {
      const { data, error } = await supabase.auth.getUser(authHeader.slice(7));
      if (error || !data.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
      user = data.user;
    } else {
      const { data, error } = await supabase.auth.getUser();
      if (error || !data.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
      user = data.user;
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
