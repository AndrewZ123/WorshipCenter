import { NextRequest, NextResponse } from 'next/server';
import { getRequestUser } from '@/lib/auth-middleware';
import { db } from '@/lib/store';
import { sendEmail, isEmailConfigured } from '@/lib/email';
import { serviceReminderEmail } from '@/lib/email-templates';
import { z } from 'zod';

const SendReminderSchema = z.object({
  serviceId: z.string().uuid('Invalid service ID'),
  churchId: z.string().uuid('Invalid church ID'),
  serviceTitle: z.string().min(1).max(200),
  serviceDate: z.string().min(1),
  serviceTime: z.string().min(1),
});

function jsonResponse(data: any, status: number = 200): NextResponse {
  return new NextResponse(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

export async function POST(request: NextRequest) {
  try {
    const user = await getRequestUser(request);
    if (!user) {
      return jsonResponse({ error: 'Unauthorized' }, 401);
    }

    const body = SendReminderSchema.parse(await request.json());
    const { serviceId, churchId, serviceTitle, serviceDate, serviceTime } = body;

    if (user.church_id !== churchId) {
      return jsonResponse({ error: 'Access denied' }, 403);
    }

    const church = await db.churches.getById(churchId);
    if (!church) {
      return jsonResponse({ error: 'Church not found' }, 404);
    }

    const assignments = await db.assignments.getByService(serviceId, churchId);
    if (!assignments || assignments.length === 0) {
      return jsonResponse({ success: true, message: 'No team members to remind', emailsSent: 0 });
    }

    const emailConfigured = await isEmailConfigured();

    const teamMembers = await Promise.all(
      assignments.map(async (assignment) => {
        const member = await db.teamMembers.getById(assignment.team_member_id, churchId);
        return { member, role: assignment.role, status: assignment.status };
      })
    );

    let emailsSent = 0;
    for (const { member, role, status } of teamMembers) {
      if (!member || !member.email || status !== 'confirmed') continue;

      await db.notifications.create({
        church_id: churchId,
        user_id: '',
        type: 'service_reminder',
        title: `Service Reminder: ${serviceTitle}`,
        message: `Reminder: You're serving as ${role} on ${new Date(serviceDate).toLocaleDateString()} at ${serviceTime}`,
        service_id: serviceId,
        read: false,
      });

      if (emailConfigured) {
        const { html, text } = serviceReminderEmail({
          memberName: member.name,
          churchName: church.name,
          serviceTitle,
          serviceDate,
          serviceTime,
          role,
        });
        const result = await sendEmail({
          to: member.email,
          subject: `Reminder: Serving ${role} — ${serviceTitle}`,
          html,
          text,
        });
        if (result.success) emailsSent++;
      }
    }

    return jsonResponse({ success: true, emailsSent });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return jsonResponse({ error: 'Validation failed', details: error.issues }, 400);
    }
    console.error('[Send Reminder] Error:', error);
    return jsonResponse({ error: 'Failed to send reminders' }, 500);
  }
}