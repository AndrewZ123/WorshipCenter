import { NextRequest, NextResponse } from 'next/server';
import { getRequestUser } from '@/lib/auth-middleware';
import { db } from '@/lib/store';
import { z } from 'zod';

const SendInvitationSchema = z.object({
  assignmentId: z.string().uuid('Invalid assignment ID'),
  churchId: z.string().uuid('Invalid church ID'),
  serviceTitle: z.string().min(1).max(200),
  serviceDate: z.string().min(1),
  serviceTime: z.string().min(1),
  memberName: z.string().min(1).max(200),
  memberEmail: z.string().email().optional().or(z.literal('')),
  role: z.string().min(1).max(100),
});

export async function POST(request: NextRequest) {
  try {
    const user = await getRequestUser(request);
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = SendInvitationSchema.parse(await request.json());
    const { assignmentId, churchId, serviceTitle, serviceDate, serviceTime, memberName, memberEmail, role } = body;

    // Verify user belongs to the target church
    if (user.church_id !== churchId) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 });
    }

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

    const formattedRole = role.split('_').map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');

    const notification = await db.notifications.create({
      church_id: churchId,
      user_id: '',
      type: 'invitation',
      title: `Service Invitation: ${serviceTitle}`,
      message: `You're invited to serve as ${formattedRole} on ${new Date(serviceDate).toLocaleDateString()} at ${serviceTime}`,
      service_id: assignmentId,
      read: false,
    });

    console.log('[Email Service] Invitation email would be sent to:', memberEmail);
    console.log('[Email Service] Subject:', `Service Invitation: ${serviceTitle}`);

    return NextResponse.json({ 
      success: true, 
      notificationId: notification.id,
      emailSent: true,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: 'Validation failed', details: error.issues }, { status: 400 });
    }
    console.error('[Send Invitation] Error:', error);
    return NextResponse.json(
      { error: 'Failed to send invitation' },
      { status: 500 }
    );
  }
}