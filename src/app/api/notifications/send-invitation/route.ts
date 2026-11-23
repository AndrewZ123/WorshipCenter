import { NextRequest, NextResponse } from 'next/server';
import { checkRateLimit, getClientIp, getRequestUser, rateLimitResponse } from '@/lib/auth-middleware';
import { requireActiveSubscription } from '@/lib/subscription-middleware';
import { db } from '@/lib/store';
import { supabaseAdmin } from '@/lib/supabase';
import { sendEmail, isEmailConfigured } from '@/lib/email';
import { serviceInvitationEmail } from '@/lib/email-templates';
import { buildResponseUrls, createResponseToken } from '@/lib/assignment-response-tokens';
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
    const limit = checkRateLimit(`send-invitation:${getClientIp(request)}`, 50, 60 * 60 * 1000);
    if (!limit.allowed) {
      return rateLimitResponse(limit);
    }

    const user = await getRequestUser(request);
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const subscriptionCheck = await requireActiveSubscription(request);
    if (subscriptionCheck !== true) {
      return subscriptionCheck;
    }

    let rawBody: unknown;
    try {
      rawBody = await request.json();
    } catch {
      return NextResponse.json({ error: 'Invalid request' }, { status: 400 });
    }

    const parsedBody = SendInvitationSchema.safeParse(rawBody);
    if (!parsedBody.success) {
      return NextResponse.json({ error: 'Invalid request' }, { status: 400 });
    }

    const { assignmentId, churchId, serviceTitle, serviceDate, serviceTime, memberName, memberEmail, role } = parsedBody.data;

    if (user.church_id !== churchId) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 });
    }

    if (!memberEmail) {
      return NextResponse.json({ error: 'Team member has no email address' }, { status: 400 });
    }

    const { data: church } = await supabaseAdmin
      .from('churches')
      .select('*')
      .eq('id', churchId)
      .maybeSingle();
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
    let acceptUrl = `${baseUrl}/api/assignments/${assignmentId}/confirm`;
    let declineUrl = `${baseUrl}/api/assignments/${assignmentId}/decline`;

    const emailConfigured = await isEmailConfigured();

    // Prefer single-use, tokenized accept/decline links. Fall back to the
    // legacy id links if the token cannot be created (e.g. migration not yet
    // applied) so invitations still go out.
    if (emailConfigured) {
      try {
        const rawToken = await createResponseToken(assignmentId, churchId, serviceDate);
        ({ confirmUrl: acceptUrl, declineUrl } = buildResponseUrls(rawToken));
      } catch (error) {
        console.error('[Send Invitation] Response token creation failed:', error);
      }
    }

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