import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/store';
import { sendEmail, isEmailConfigured } from '@/lib/email';

interface SendTeamInvitationRequest {
  teamMemberId: string;
  churchId: string;
}

export async function POST(request: NextRequest) {
  try {
    const body: SendTeamInvitationRequest = await request.json();
    const { teamMemberId, churchId } = body;

    // Get team member details
    const teamMember = await db.teamMembers.getById(teamMemberId, churchId);
    if (!teamMember) {
      return NextResponse.json({ error: 'Team member not found' }, { status: 404 });
    }

    if (!teamMember.email) {
      return NextResponse.json(
        { error: 'Team member has no email address' },
        { status: 400 }
      );
    }

    // Get church details
    const church = await db.churches.getById(churchId);
    if (!church) {
      return NextResponse.json({ error: 'Church not found' }, { status: 404 });
    }

    // Generate invite link
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || new URL(request.url).origin;
    const inviteUrl = `${baseUrl}/join?e=${encodeURIComponent(teamMember.email)}&c=${churchId}`;

    // Send email if configured
    let emailResult = null;
    if (isEmailConfigured()) {
      console.log('[Send Team Invitation] Email service configured. Attempting to send email to:', teamMember.email);
      console.log('[Send Team Invitation] RESEND_API_KEY exists:', !!process.env.RESEND_API_KEY);
      console.log('[Send Team Invitation] EMAIL_FROM:', process.env.EMAIL_FROM);
      
      emailResult = await sendEmail({
        to: teamMember.email,
        subject: `You're invited to join ${church.name} on WorshipCenter`,
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <h2>You're invited to join ${church.name}!</h2>
            <p>You've been invited to join the team at ${church.name} on WorshipCenter.</p>
            <p>Click the button below to accept your invitation and get started:</p>
            <div style="text-align: center; margin: 30px 0;">
              <a href="${inviteUrl}" 
                 style="background-color: #4F46E5; color: white; padding: 12px 24px; 
                        text-decoration: none; border-radius: 6px; display: inline-block;">
                Accept Invitation
              </a>
            </div>
            <p>Or copy and paste this link into your browser:</p>
            <p style="word-break: break-all; color: #666;">${inviteUrl}</p>
            <p style="margin-top: 30px; font-size: 14px; color: #666;">
              If you didn't expect this invitation, you can safely ignore this email.
            </p>
          </div>
        `,
        text: `You're invited to join ${church.name} on WorshipCenter!

Click the link below to accept your invitation:
${inviteUrl}

If you didn't expect this invitation, you can safely ignore this email.`,
      });
      
      console.log('[Send Team Invitation] Email result:', emailResult);
    } else {
      const apiKeyExists = !!process.env.RESEND_API_KEY;
      const emailFromExists = !!process.env.EMAIL_FROM;
      console.error('[Send Team Invitation] Email service not configured!');
      console.error('[Send Team Invitation] RESEND_API_KEY exists:', apiKeyExists);
      console.error('[Send Team Invitation] EMAIL_FROM exists:', emailFromExists);
      
      return NextResponse.json(
        { 
          error: 'Email service not configured',
          details: {
            apiKeyExists,
            emailFromExists,
          }
        },
        { status: 500 }
      );
    }

    if (!emailResult?.success) {
      console.error('[Send Team Invitation] Email failed to send:', emailResult?.error);
      return NextResponse.json(
        { 
          error: 'Failed to send email',
          details: emailResult?.error || 'Unknown error',
        },
        { status: 500 }
      );
    }

    return NextResponse.json({ 
      success: true, 
      emailSent: true,
      inviteUrl,
      message: 'Invitation sent successfully',
    });
  } catch (error) {
    console.error('[Send Team Invitation] Error:', error);
    return NextResponse.json(
      { error: 'Failed to send team invitation' },
      { status: 500 }
    );
  }
}