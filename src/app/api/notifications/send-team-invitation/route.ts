import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/store';

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

    // Email service is not yet configured - returning success for now
    // TODO: Implement actual email sending when email service is configured
    return NextResponse.json({ 
      success: true, 
      emailSent: false, // Changed to false since we're not actually sending emails yet
      inviteUrl,
    });
  } catch (error) {
    console.error('[Send Team Invitation] Error:', error);
    return NextResponse.json(
      { error: 'Failed to send team invitation' },
      { status: 500 }
    );
  }
}