import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { sendEmail, isEmailConfigured } from '@/lib/email';
import { assignmentDeclinedEmail } from '@/lib/email-templates';

const appUrl = process.env.NEXT_PUBLIC_APP_URL ||
  (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : 'http://localhost:3000');

function resultPage(title: string, heading: string, message: string, link?: string) {
  const href = link || `${appUrl}/dashboard`;
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
<div class="icon">${heading.includes('Declined') ? '❌' : '📋'}</div>
<h1>${heading}</h1>
<p>${message}</p>
<a href="${href}">Go to Dashboard</a>
</div></body></html>`,
    { headers: { 'Content-Type': 'text/html;charset=utf-8' } }
  );
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ assignmentId: string }> }
) {
  const { assignmentId } = await params;

  // Fetch via supabaseAdmin (no login needed)
  const { data: assignment, error: fetchError } = await supabaseAdmin
    .from('service_assignments')
    .select('*, team_members!inner(*), services!inner(id, title, date, time, church_id)')
    .eq('id', assignmentId)
    .single();

  if (fetchError || !assignment) {
    return resultPage('Not Found', 'Link invalid or expired', 'This link is no longer valid.');
  }

  const { error: updateError } = await supabaseAdmin
    .from('service_assignments')
    .update({ status: 'declined' })
    .eq('id', assignmentId);

  if (updateError) {
    return resultPage('Error', 'Failed to decline', 'Something went wrong. Please try again.');
  }

  const member = assignment.team_members;
  const svc = assignment.services;
  const churchId = svc.church_id;

  // Notify leaders via email
  const { data: church } = await supabaseAdmin
    .from('churches')
    .select('name')
    .eq('id', churchId)
    .single();

  if (church && (await isEmailConfigured())) {
    const { data: leaders } = await supabaseAdmin
      .from('team_members')
      .select('email')
      .eq('church_id', churchId)
      .or('roles.cs.{admin},roles.cs.{leader}');

    const { html, text } = assignmentDeclinedEmail({
      churchName: church.name,
      serviceTitle: svc.title,
      memberName: member.name,
      role: assignment.role,
    });
    for (const leader of leaders || []) {
      if (!leader.email) continue;
      sendEmail({
        to: leader.email,
        subject: `${member.name} declined ${svc.title}`,
        html,
        text,
      }).catch(() => {});
    }
  }

  return resultPage(
    'Declined',
    "You've Declined ❌",
    `You've declined for ${svc?.title || 'the service'}. We'll find someone to fill in.`,
    `${appUrl}/services/${svc?.id || ''}`
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
      .update({ status: 'declined' })
      .eq('id', assignmentId);

    if (updateError) {
      return NextResponse.json({ error: 'Failed to decline' }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('[Decline] Error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}