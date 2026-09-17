import { NextRequest, NextResponse } from 'next/server';
import { getRequestUser } from '@/lib/auth-middleware';
import { db } from '@/lib/store';
import { sendEmail, isEmailConfigured } from '@/lib/email';
import { teamInvitationEmail } from '@/lib/email-templates';
import { z } from 'zod';
import type { TeamMember, Church } from '@/lib/types';

const SendTeamInvitationSchema = z.object({
  teamMemberId: z.string().uuid('Invalid team member ID'),
  churchId: z.string().uuid('Invalid church ID'),
});

export async function POST(request: NextRequest) {
  try {
    const user = await getRequestUser(request);
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = SendTeamInvitationSchema.parse(await request.json());
    const { teamMemberId, churchId } = body;

    if (user.church_id !== churchId) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 });
    }

    const teamMember: TeamMember | null = await db.teamMembers.getById(teamMemberId, churchId);
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

    const church: Church | null = await db.churches.getById(churchId);
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