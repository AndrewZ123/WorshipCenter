import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/store';
import { sendEmail, isEmailConfigured } from '@/lib/email';
import type { TeamMember, Church } from '@/lib/types';

interface SendTeamInvitationRequest {
  teamMemberId: string;
  churchId: string;
}

export async function POST(request: NextRequest) {
  try {
    console.log('[Send Team Invitation] Starting request');
    
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
      return NextResponse.json({ error: 'Team member has no email address' }, { status: 400 });
    }

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

    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || (process.env.VERCEL_URL 
      ? `https://${process.env.VERCEL_URL}` 
      : 'http://localhost:3000');
    const inviteUrl = `${baseUrl}/join?church=${churchId}&email=${encodeURIComponent(teamMember.email)}`;

    const emailConfigured = await isEmailConfigured();
    console.log('[Send Team Invitation] Email service configured:', emailConfigured);

    let emailResult = null;
    if (emailConfigured) {
      try {
        emailResult = await sendEmail({
          to: teamMember.email,
          subject: `You're invited to join ${church.name} on WorshipCenter`,
          html: `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
              <h2 style="color: #319795;">You're invited to join ${church.name}!</h2>
              <p>Hello ${teamMember.name || 'there'},</p>
              <p>You've been invited to join the team at ${church.name} on WorshipCenter.</p>
              <p style="margin: 30px 0;">
                <a href="${inviteUrl}" 
                   style="background-color: #319795; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block;">
                  Accept Invitation
                </a>
              </p>
              <p style="color: #666; font-size: 14px;">
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