import { NextRequest, NextResponse } from 'next/server';
import { checkRateLimit, getClientIp, getRequestUser, rateLimitResponse } from '@/lib/auth-middleware';
import { requireActiveSubscription } from '@/lib/subscription-middleware';
import { supabaseAdmin } from '@/lib/supabase';
import { sendEmail, isEmailConfigured } from '@/lib/email';
import { teamInvitationEmail } from '@/lib/email-templates';
import { z } from 'zod';

const SendTeamInvitationSchema = z.object({
  teamMemberId: z.string().uuid('Invalid team member ID'),
  churchId: z.string().uuid('Invalid church ID'),
});

export async function POST(request: NextRequest) {
  try {
    const limit = checkRateLimit(`send-team-invitation:${getClientIp(request)}`, 50, 60 * 60 * 1000);
    if (!limit.allowed) {
      return rateLimitResponse(limit);
    }

    const user = await getRequestUser(request);
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const subscriptionCheck = await requireActiveSubscription(request);
    if (subscriptionCheck !== true) {
      return subscriptionCheck;
    }

    const body = SendTeamInvitationSchema.parse(await request.json());
    const { teamMemberId, churchId } = body;

    if (user.church_id !== churchId) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 });
    }

    const { data: teamMember } = await supabaseAdmin
      .from('team_members')
      .select('*')
      .eq('id', teamMemberId)
      .eq('church_id', churchId)
      .maybeSingle();
    if (!teamMember) {
      return NextResponse.json({ error: 'Team member not found' }, { status: 404 });
    }

    if (!teamMember.email) {
      return NextResponse.json({ error: 'Team member has no email address' }, { status: 400 });
    }

    if (teamMember.user_id) {
      return NextResponse.json({ 
        error: 'This team member is already verified',
        alreadyVerified: true,
      }, { status: 400 });
    }

    const { data: church } = await supabaseAdmin
      .from('churches')
      .select('*')
      .eq('id', churchId)
      .maybeSingle();
    if (!church) {
      return NextResponse.json({ error: 'Church not found' }, { status: 404 });
    }

    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || (process.env.VERCEL_URL 
      ? `https://${process.env.VERCEL_URL}` : 'http://localhost:3000');
    const inviteUrl = `${baseUrl}/join?e=${encodeURIComponent(teamMember.email)}&c=${churchId}`;

    const emailConfigured = await isEmailConfigured();

    if (!emailConfigured) {
      return NextResponse.json({
        success: true, emailSent: false,
        inviteUrl,
        message: 'Invitation link generated (email not configured)',
      });
    }

    const { html, text } = teamInvitationEmail({ name: teamMember.name || '', churchName: church.name, inviteUrl });
    const emailResult = await sendEmail({
      to: teamMember.email,
      subject: `You're invited to join ${church.name} on WorshipCenter`,
      html,
      text,
    });

    return NextResponse.json({ success: true, emailSent: !!emailResult?.success, inviteUrl });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: 'Validation failed', details: error.issues }, { status: 400 });
    }
    console.error('[Send Team Invitation] Error:', error);
    return NextResponse.json({ error: 'Failed to send team invitation' }, { status: 500 });
  }
}