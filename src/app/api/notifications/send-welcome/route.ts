import { NextRequest, NextResponse } from 'next/server';
import { checkRateLimit, getClientIp, getRequestUser, rateLimitResponse } from '@/lib/auth-middleware';
import { requireActiveSubscription } from '@/lib/subscription-middleware';
import { supabaseAdmin } from '@/lib/supabase';
import { welcomeEmail } from '@/lib/email-templates';
import { SendWelcomeSchema, invalidInputResponse } from '@/lib/validation';

function jsonResponse(data: Record<string, unknown>, status: number = 200): NextResponse {
  return new NextResponse(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

export async function POST(request: NextRequest) {
  try {
    const limit = checkRateLimit(`send-welcome:${getClientIp(request)}`, 50, 60 * 60 * 1000);
    if (!limit.allowed) {
      return rateLimitResponse(limit);
    }

    const authUser = await getRequestUser(request);
    if (!authUser) {
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
      return invalidInputResponse();
    }

    const parsedBody = SendWelcomeSchema.safeParse(rawBody);
    if (!parsedBody.success) {
      return invalidInputResponse();
    }

    const { userId, churchId } = parsedBody.data;

    // A user may only trigger a welcome email for themselves, within their own church.
    if (userId !== authUser.id || churchId !== authUser.church_id) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 });
    }

    // The request is authenticated and authorized above, but the anonymous
    // client carries no JWT, so RLS would reject these reads. Use the
    // service-role admin client (same as getRequestUser/verifyAuthToken).
    let userResult, churchResult;
    try {
      [userResult, churchResult] = await Promise.all([
        supabaseAdmin.from('users').select('*').eq('id', userId).single(),
        supabaseAdmin.from('churches').select('*').eq('id', churchId).single(),
      ]);
    } catch (dbError) {
      console.error('[Welcome Email] Database query error:', dbError);
      return jsonResponse({ error: 'Database query failed' }, 500);
    }

    if (userResult.error || !userResult.data) {
      console.error('[Welcome Email] User fetch error:', userResult.error);
      return jsonResponse({ error: 'User not found' }, 404);
    }

    if (churchResult.error || !churchResult.data) {
      console.error('[Welcome Email] Church fetch error:', churchResult.error);
      return jsonResponse({ error: 'Church not found' }, 404);
    }

    const user = userResult.data;
    const church = churchResult.data;
    const adminName = user.name;
    const churchName = church.name;
    const userEmail = user.email;

    const resendApiKey = process.env.RESEND_API_KEY;
    if (!resendApiKey) {
      console.error('[Welcome Email] RESEND_API_KEY not configured');
      return jsonResponse({ error: 'Email service not configured (RESEND_API_KEY missing)' }, 500);
    }

    const appUrl = process.env.NEXT_PUBLIC_APP_URL ||
      (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : 'http://localhost:3000');

    let emailResponse;
    try {
      console.log('[Welcome Email] Sending email via Resend API');
      const { html, text } = welcomeEmail({ adminName, churchName, appUrl });
      emailResponse = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${resendApiKey}`,
        },
        body: JSON.stringify({
          from: process.env.EMAIL_FROM || 'WorshipCenter <welcome@worshipcenter.app>',
          to: [userEmail],
          subject: `Welcome to WorshipCenter at ${churchName}!`,
          html,
          text,
        }),
      });
    } catch (fetchError) {
      console.error('[Welcome Email] Fetch error when calling Resend API:', fetchError);
      return jsonResponse({ error: 'Failed to send welcome email' }, 500);
    }

    if (!emailResponse.ok) {
      let errorText = 'Unknown error';
      try { errorText = await emailResponse.text(); } catch { console.error('[Welcome Email] Could not parse error response'); }
      console.error('[Welcome Email] Resend API error:', errorText);
      // Do not leak the provider's response body to the caller.
      return jsonResponse({ error: 'Failed to send welcome email' }, 500);
    }

    console.log('[Welcome Email] Successfully sent welcome email');
    return jsonResponse({ success: true });
  } catch (error) {
    console.error('[Welcome Email] Unhandled error:', error);
    return jsonResponse({ error: 'Internal server error' }, 500);
  }
}
