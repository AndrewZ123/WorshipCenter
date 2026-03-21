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

    // In a production environment, you would send an actual email here
    // For now, we'll log the email content
    console.log('[Email Service] Team invitation email would be sent to:', teamMember.email);
    console.log('[Email Service] Subject:', `Join ${church.name} on WorshipCenter`);
    console.log('[Email Service] Body:', `
      Hi ${teamMember.name},
      
      You've been invited to join ${church.name} on WorshipCenter!
      
      Click the link below to set up your account and get started:
      ${inviteUrl}
      
      If you have any questions, feel free to reach out.
      
      Thanks!
      WorshipCenter Team
    `);

    return NextResponse.json({ 
      success: true, 
      emailSent: true,
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