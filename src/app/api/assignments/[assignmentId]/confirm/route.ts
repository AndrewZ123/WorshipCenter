import { NextRequest, NextResponse } from 'next/server';
import { supabase, supabaseAdmin } from '@/lib/supabase';
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
    return resultPage('Error', 'Account not found', 'Could not find your account.');
  }

  const { data: assignment } = await supabaseAdmin
    .from('service_assignments')
    .select('*, team_members!inner(*)')
    .eq('id', assignmentId)
    .single();

  if (!assignment) {
    return resultPage('Not Found', 'Assignment not found', 'This assignment may have been removed.');
  }

  if (assignment.team_members.user_id !== user.id) {
    return resultPage('Access Denied', 'Not your assignment', 'This confirmation link belongs to a different team member.');
  }

  const { error: updateError } = await supabaseAdmin
    .from('service_assignments')
    .update({ status: 'confirmed' })
    .eq('id', assignmentId);

  if (updateError) {
    return resultPage('Error', 'Failed to confirm', 'Something went wrong. Please try again.');
  }

  const { data: service } = await supabaseAdmin
    .from('services')
    .select('id, title, date, time')
    .eq('id', assignment.service_id)
    .single();

  if (service) {
    // Notify leaders
    const { data: leaders } = await supabaseAdmin
      .from('team_members')
      .select('user_id')
      .eq('church_id', userData.church_id)
      .or('roles.cs.{admin},roles.cs.{leader}');

    for (const leader of leaders || []) {
      if (leader.user_id && leader.user_id !== user.id) {
        sendConfirmationNotification({
          leaderId: leader.user_id,
          serviceId: service.id,
          serviceName: service.title,
          userName: assignment.team_members.name,
          role: assignment.role,
          serviceDate: service.date,
          organizationId: userData.church_id,
        }).catch(() => {});
      }
    }

    // Send confirmation email
    if (assignment.team_members.email && (await isEmailConfigured())) {
      const { data: church } = await supabaseAdmin
        .from('churches')
        .select('name')
        .eq('id', userData.church_id)
        .single();
      if (church) {
        const { html, text } = assignmentConfirmedEmail({
          memberName: assignment.team_members.name,
          churchName: church.name,
          serviceTitle: service.title,
          serviceDate: service.date,
          serviceTime: service.time || '',
          role: assignment.role,
        });
        sendEmail({
          to: assignment.team_members.email,
          subject: `Confirmed: ${service.title}`,
          html,
          text,
        }).catch(() => {});
      }
    }
  }

  return resultPage(
    'Confirmed!',
    "You're Confirmed! ✅",
    `You've confirmed for ${service?.title || 'the service'}. Thanks for serving!`,
    `${appUrl}/services/${service?.id || ''}`
  );
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ assignmentId: string }> }
) {
  try {
    const authHeader = request.headers.get('Authorization');
    const token = authHeader?.replace('Bearer ', '');
    if (!token) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(token);
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { assignmentId } = await params;

    const { data: userData } = await supabaseAdmin
      .from('users')
      .select('church_id')
      .eq('id', user.id)
      .single();

    if (!userData) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    const { data: assignment } = await supabaseAdmin
      .from('service_assignments')
      .select('*, team_members!inner(*)')
      .eq('id', assignmentId)
      .single();

    if (!assignment) {
      return NextResponse.json({ error: 'Assignment not found' }, { status: 404 });
    }

    if (assignment.team_members.user_id !== user.id) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const { error: updateError } = await supabaseAdmin
      .from('service_assignments')
      .update({ status: 'confirmed' })
      .eq('id', assignmentId);

    if (updateError) {
      return NextResponse.json({ error: 'Failed to confirm' }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('[Confirm] Error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}