import { NextRequest, NextResponse } from 'next/server';
import { getRequestUser } from '@/lib/auth-middleware';
import { db } from '@/lib/store';
import { sendEmail, isEmailConfigured } from '@/lib/email';
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

    const emailResult = await sendEmail({
      to: teamMember.email,
      subject: `You're invited to join ${church.name} on WorshipCenter`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #319795;">You're invited to join ${church.name}!</h2>
          <p>Hello ${teamMember.name || 'there'},</p>
          <p>You've been invited to join the team at ${church.name} on WorshipCenter.</p>
          <p style="margin: 30px 0;">
            <a href="${inviteUrl}" style="background-color: #319795; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block;">
              Accept Invitation
            </a>
          </p>
        </div>
      `,
      text: `You're invited to join ${church.name} on WorshipCenter!\n\n${inviteUrl}`,
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