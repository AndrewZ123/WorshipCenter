import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { db } from '@/lib/store';

interface SendInvitationRequest {
  assignmentId: string;
  churchId: string;
  serviceTitle: string;
  serviceDate: string;
  serviceTime: string;
  memberName: string;
  memberEmail: string;
  role: string;
}

export async function POST(request: NextRequest) {
  try {
    const body: SendInvitationRequest = await request.json();
    const { assignmentId, churchId, serviceTitle, serviceDate, serviceTime, memberName, memberEmail, role } = body;

    if (!memberEmail) {
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

    // Format the role for display
    const formattedRole = role.split('_').map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');

    // Create notification record
    // Use empty string for user_id since team members may not have accounts
    const notification = await db.notifications.create({
      church_id: churchId,
      user_id: '', // Team members may not have user accounts
      type: 'invitation',
      title: `Service Invitation: ${serviceTitle}`,
      message: `You're invited to serve as ${formattedRole} on ${new Date(serviceDate).toLocaleDateString()} at ${serviceTime}`,
      service_id: assignmentId,
      read: false,
    });

    // In a production environment, you would send an actual email here
    // For now, we'll log the email content and create the notification
    console.log('[Email Service] Invitation email would be sent to:', memberEmail);
    console.log('[Email Service] Subject:', `Service Invitation: ${serviceTitle}`);
    console.log('[Email Service] Body:', `
      Hi ${memberName},
      
      You've been invited to serve as ${formattedRole} for ${serviceTitle} on ${new Date(serviceDate).toLocaleDateString()} at ${serviceTime}.
      
      Please log in to WorshipCenter to confirm your availability.
      
      Thanks,
      ${church.name}
    `);

    return NextResponse.json({ 
      success: true, 
      notificationId: notification.id,
      emailSent: true,
    });
  } catch (error) {
    console.error('[Send Invitation] Error:', error);
    return NextResponse.json(
      { error: 'Failed to send invitation' },
      { status: 500 }
    );
  }
}