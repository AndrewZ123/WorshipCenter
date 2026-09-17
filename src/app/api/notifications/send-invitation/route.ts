import { NextRequest, NextResponse } from 'next/server';
import { getRequestUser } from '@/lib/auth-middleware';
import { db } from '@/lib/store';
import { sendEmail, isEmailConfigured } from '@/lib/email';
import { serviceInvitationEmail } from '@/lib/email-templates';
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

    if (user.church_id !== churchId) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 });
    }

    if (!memberEmail) {
      return NextResponse.json({ error: 'Team member has no email address' }, { status: 400 });
    }

    const church = await db.churches.getById(churchId);
    if (!church) {
      return NextResponse.json({ error: 'Church not found' }, { status: 404 });
    }

    const notification = await db.notifications.create({
      church_id: churchId,
      user_id: '',
      type: 'invitation',
      title: `Service Invitation: ${serviceTitle}`,
      message: `You're invited to serve as ${role} on ${new Date(serviceDate).toLocaleDateString()} at ${serviceTime}`,
      service_id: assignmentId,
      read: false,
    });

    const baseUrl = process.env.NEXT_PUBLIC_APP_URL ||
      (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : 'http://localhost:3000');
    const acceptUrl = `${baseUrl}/api/assignments/${assignmentId}/confirm`;
    const declineUrl = `${baseUrl}/api/assignments/${assignmentId}/decline`;

    const emailConfigured = await isEmailConfigured();
    let emailSent = false;

    if (emailConfigured) {
      const { html, text } = serviceInvitationEmail({
        memberName,
        churchName: church.name,
        serviceTitle,
        serviceDate,
        serviceTime,
        role,
        acceptUrl,
        declineUrl,
      });
      const result = await sendEmail({
        to: memberEmail,
        subject: `Service Invitation: ${serviceTitle}`,
        html,
        text,
      });
      emailSent = result.success;
    }

    return NextResponse.json({
      success: true,
      notificationId: notification.id,
      emailSent,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: 'Validation failed', details: error.issues }, { status: 400 });
    }
    console.error('[Send Invitation] Error:', error);
    return NextResponse.json({ error: 'Failed to send invitation' }, { status: 500 });
  }
}