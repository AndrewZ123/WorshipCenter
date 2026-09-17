import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { welcomeEmail } from '@/lib/email-templates';

interface WelcomeEmailRequest {
  userId: string;
  churchId: string;
}

function jsonResponse(data: any, status: number = 200): NextResponse {
  return new NextResponse(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

export async function POST(request: NextRequest) {
  try {
    console.log('[Welcome Email] Starting request');

    let body: WelcomeEmailRequest;
    try {
      body = await request.json();
      console.log('[Welcome Email] Request body:', { userId: body.userId, churchId: body.churchId });
    } catch (parseError) {
      console.error('[Welcome Email] Failed to parse request body:', parseError);
      return jsonResponse({ error: 'Invalid request body', details: parseError instanceof Error ? parseError.message : 'Unknown parsing error' }, 400);
    }

    const { userId, churchId } = body;

    if (!userId || !churchId) {
      console.error('[Welcome Email] Missing required fields:', { userId, churchId });
      return jsonResponse({ error: 'userId and churchId are required' }, 400);
    }

    let userResult, churchResult;
    try {
      console.log('[Welcome Email] Fetching user and church data');
      [userResult, churchResult] = await Promise.all([
        supabase.from('users').select('*').eq('id', userId).single(),
        supabase.from('churches').select('*').eq('id', churchId).single(),
      ]);
    } catch (dbError) {
      console.error('[Welcome Email] Database query error:', dbError);
      return jsonResponse({ error: 'Database query failed', details: String(dbError) }, 500);
    }

    if (userResult.error || !userResult.data) {
      console.error('[Welcome Email] User fetch error:', userResult.error);
      return jsonResponse({ error: 'Failed to fetch user', details: userResult.error?.message }, 404);
    }

    if (churchResult.error || !churchResult.data) {
      console.error('[Welcome Email] Church fetch error:', churchResult.error);
      return jsonResponse({ error: 'Failed to fetch church', details: churchResult.error?.message }, 404);
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
      console.log('[Welcome Email] Sending email via Resend API to:', userEmail);
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
      return jsonResponse({ error: 'Failed to send welcome email', details: fetchError instanceof Error ? fetchError.message : 'Unknown fetch error' }, 500);
    }

    if (!emailResponse.ok) {
      let errorText = 'Unknown error';
      try { errorText = await emailResponse.text(); } catch (e) { console.error('[Welcome Email] Could not parse error response'); }
      console.error('[Welcome Email] Resend API error:', errorText);
      return jsonResponse({ error: 'Failed to send welcome email', details: errorText, statusCode: emailResponse.status }, 500);
    }

    console.log('[Welcome Email] Successfully sent welcome email to:', userEmail);
    return jsonResponse({ success: true });
  } catch (error) {
    console.error('[Welcome Email] Unhandled error:', error);
    return jsonResponse({ error: 'Internal server error', details: error instanceof Error ? error.message : 'Unknown error' }, 500);
  }
}