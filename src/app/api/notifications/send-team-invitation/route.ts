import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/store';
import { sendEmail, isEmailConfigured, getEmailConfigStatus } from '@/lib/email';
import type { TeamMember, Church } from '@/lib/types';

interface SendTeamInvitationRequest {
  teamMemberId: string;
  churchId: string;
}

export async function POST(request: NextRequest) {
  try {
    console.log('[Send Team Invitation] Starting request');
    
    // Parse request body with error handling
    let body: SendTeamInvitationRequest;
    try {
      body = await request.json();
      console.log('[Send Team Invitation] Request body:', body);
    } catch (parseError) {
      console.error('[Send Team Invitation] Failed to parse request body:', parseError);
      return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
    }
    
    const { teamMemberId, churchId } = body;

    if (!teamMemberId || !churchId) {
      console.error('[Send Team Invitation] Missing required fields:', { teamMemberId, churchId });
      return NextResponse.json({ error: 'Missing required fields: teamMemberId and churchId' }, { status: 400 });
    }

    // Get team member details with error handling
    let teamMember: TeamMember | null;
    try {
      console.log('[Send Team Invitation] Fetching team member:', teamMemberId, 'for church:', churchId);
      teamMember = await db.teamMembers.getById(teamMemberId, churchId);
      if (!teamMember) {
        console.warn('[Send Team Invitation] Team member not found');
        return NextResponse.json({ error: 'Team member not found' }, { status: 404 });
      }
      console.log('[Send Team Invitation] Team member found:', teamMember.name);
    } catch (dbError) {
      console.error('[Send Team Invitation] Database error fetching team member:', dbError);
      return NextResponse.json({ error: 'Database error fetching team member', details: String(dbError) }, { status: 500 });
    }

    if (!teamMember.email) {
      console.warn('[Send Team Invitation] Team member has no email');
      return NextResponse.json(
        { error: 'Team member has no email address' },
        { status: 400 }
      );
    }

    // Get church details with error handling
    let church: Church | null;
    try {
      console.log('[Send Team Invitation] Fetching church:', churchId);
      church = await db.churches.getById(churchId);
      if (!church) {
        console.warn('[Send Team Invitation] Church not found');
        return NextResponse.json({ error: 'Church not found' }, { status: 404 });
      }
      console.log('[Send Team Invitation] Church found:', church.name);
    } catch (dbError) {
      console.error('[Send Team Invitation] Database error fetching church:', dbError);
      return NextResponse.json({ error: 'Database error fetching church', details: String(dbError) }, { status: 500 });
    }

    // Generate invite link
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || new URL(request.url).origin;
    const inviteUrl = `${baseUrl}/join?e=${encodeURIComponent(teamMember.email)}&c=${churchId}`;
    console.log('[Send Team Invitation] Generated invite URL');

    // Check if email service is configured
    const emailConfigured = await isEmailConfigured();
    console.log('[SendlTea. Invitltoon] Emaig service c'[Senared:',nitionConfigured);] Email service configured:', emailConfigured);

    // Send email if configured
    let emailResult = null;
    if (emailConfigured) {
      try {
        console.log('[Send Team Invitation] Attempting to send email to:', teamMember.email);
        
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
      } catch (emailError) {
        console.error('[Send Team Invitation] Error sending email:', emailError);
        // Don't fail the entire request - just mark email as not sent
        emailResult = { success: false, error: emailError instanceof Error ? emailError.message : 'Unknown error' };
      }
    } else {
      console.warn('[Send Team Invitation] Email service not configured - skipping email send');
    }

    console.log('[Send Team Invitation] Request completed successfully');
    
    return NextResponse.json({ 
      success: true, 
      emailSent: !!emailResult?.success,
      emailError: emailResult?.error,
      inviteUrl,
      message: emailResult?.success 
        ? 'Invitation sent successfully' 
        : 'Invitation link generated (email not configured - copy the link below)',
    });
  } catch (error) {
    console.error('[Send Team Invitation] Unhandled error:', error);
    console.error('[Send Team Invitation] Error stack:', error instanceof Error ? error.stack : 'No stack trace');
    
    return NextResponse.json(
      { 
        error: 'Failed to send team invitation', 
        details: error instanceof Error ? error.message : 'Unknown error',
        type: error instanceof Error ? error.constructor.name : 'Unknown'
      },
      { status: 500 }
    );
  }
}
