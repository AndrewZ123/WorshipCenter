import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/store';
import { sendEmail, isEmailConfigured } from '@/lib/email';
import type { TeamMember, Church } from '@/lib/types';

interface SendTeamInvitationRequest {
  teamMemberId: string;
  churchId: string;
}

/**
 * Helper function to create JSON response with explicit Content-Type header
 */
function jsonResponse(data: any, status: number = 200): NextResponse {
  return new NextResponse(JSON.stringify(data), {
    status,
    headers: {
      'Content-Type': 'application/json',
    },
  });
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
      return jsonResponse(
        { 
          error: 'Invalid request body',
          details: parseError instanceof Error ? parseError.message : 'Unknown parsing error'
        }, 
        400
      );
    }
    
    const { teamMemberId, churchId } = body;

    if (!teamMemberId || !churchId) {
      console.error('[Send Team Invitation] Missing required fields:', { teamMemberId, churchId });
      return jsonResponse({ error: 'Missing required fields: teamMemberId and churchId' }, 400);
    }

    let teamMember: TeamMember | null;
    try {
      console.log('[Send Team Invitation] Fetching team member:', teamMemberId, 'for church:', churchId);
      teamMember = await db.teamMembers.getById(teamMemberId, churchId);
      if (!teamMember) {
        console.warn('[Send Team Invitation] Team member not found');
        return jsonResponse({ error: 'Team member not found' }, 404);
      }
      console.log('[Send Team Invitation] Team member found:', teamMember.name);
    } catch (dbError) {
      console.error('[Send Team Invitation] Database error fetching team member:', dbError);
      return jsonResponse(
        { 
          error: 'Database error fetching team member', 
          details: String(dbError) 
        }, 
        500
      );
    }

    if (!teamMember.email) {
      console.warn('[Send Team Invitation] Team member has no email');
      return jsonResponse({ error: 'Team member has no email address' }, 400);
    }

    // Check if the team member is already verified (has a user_id)
    if (teamMember.user_id) {
      console.warn('[Send Team Invitation] Team member is already verified:', teamMember.name);
      return jsonResponse({ 
        error: 'This team member is already verified and cannot receive an invitation',
        alreadyVerified: true
      }, 400);
    }

    let church: Church | null;
    try {
      console.log('[Send Team Invitation] Fetching church:', churchId);
      church = await db.churches.getById(churchId);
      if (!church) {
        console.warn('[Send Team Invitation] Church not found');
        return jsonResponse({ error: 'Church not found' }, 404);
      }
      console.log('[Send Team Invitation] Church found:', church.name);
    } catch (dbError) {
      console.error('[Send Team Invitation] Database error fetching church:', dbError);
      return jsonResponse(
        { 
          error: 'Database error fetching church', 
          details: String(dbError) 
        }, 
        500
      );
    }

    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || (process.env.VERCEL_URL 
      ? `https://${process.env.VERCEL_URL}` 
      : 'http://localhost:3000');
    const inviteUrl = `${baseUrl}/join?e=${encodeURIComponent(teamMember.email)}&c=${churchId}`;

    const emailConfigured = await isEmailConfigured();
    console.log('[Send Team Invitation] Email service configured:', emailConfigured);

    if (!emailConfigured) {
      console.warn('[Send Team Invitation] Email service not configured - returning early with invite link');
      console.warn('[Send Team Invitation] Check environment variables: RESEND_API_KEY and EMAIL_FROM');
      return jsonResponse({
        success: true, 
        emailSent: false,
        emailError: 'Email service not configured (RESEND_API_KEY or EMAIL_FROM missing in environment variables)',
        inviteUrl,
        message: 'Invitation link generated (email not configured - please set RESEND_API_KEY and EMAIL_FROM in Vercel environment variables)',
      });
    }

    let emailResult = null;
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
      console.error('[Send Team Invitation] Error stack:', emailError instanceof Error ? emailError.stack : 'No stack trace');
      console.error('[Send Team Invitation] Error details:', {
        message: emailError instanceof Error ? emailError.message : 'Unknown error',
        name: emailError instanceof Error ? emailError.name : 'Unknown',
        constructor: emailError instanceof Error ? emailError.constructor.name : 'Unknown'
      });
      emailResult = { 
        success: false, 
        error: emailError instanceof Error ? emailError.message : 'Unknown error',
        type: emailError instanceof Error ? emailError.constructor.name : 'Unknown'
      };
    }

    console.log('[Send Team Invitation] Request completed successfully');
    
    return jsonResponse({
      success: true, 
      emailSent: !!emailResult?.success,
      emailError: emailResult?.error,
      emailErrorType: 'type' in (emailResult || {}) ? (emailResult as any)?.type : undefined,
      inviteUrl,
      message: emailResult?.success 
        ? 'Invitation sent successfully' 
        : emailResult?.error 
          ? `Email failed: ${emailResult.error}`
          : 'Invitation link generated (email not configured - copy the link below)',
    });
  } catch (error) {
    console.error('[Send Team Invitation] Unhandled error:', error);
    console.error('[Send Team Invitation] Error stack:', error instanceof Error ? error.stack : 'No stack trace');
    console.error('[Send Team Invitation] Error details:', {
      message: error instanceof Error ? error.message : 'Unknown error',
      name: error instanceof Error ? error.name : 'Unknown',
      constructor: error instanceof Error ? error.constructor.name : 'Unknown'
    });
    
    return jsonResponse(
      { 
        error: 'Failed to send team invitation', 
        details: error instanceof Error ? error.message : 'Unknown error',
        type: error instanceof Error ? error.constructor.name : 'Unknown'
      },
      500
    );
  }
}