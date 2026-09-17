import { NextResponse } from 'next/server';
import { handleRemindersRequest } from '@/lib/reminders';

// Reminder Job API Endpoint
// This endpoint can be called by Vercel Cron Jobs or external cron services
// to trigger automated reminder and escalation notifications.
//
// Vercel Cron configuration: Set path to /api/reminders with schedule "*/15 * * * *"
// The job runs every 15 minutes to check for:
// - Initial confirmation reminders (48h after pending assignment)
// - Pre-rehearsal reminders (24h before)
// - Pre-service reminders (48h before)
// - Leader escalations (24h before service for pending assignments)

export async function GET(request: Request) {
  try {
    if (!isAuthorized(request)) {
      return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 401 });
    }
    const result = await handleRemindersRequest();
    
    return NextResponse.json(result, {
      status: result.success ? 200 : 500,
    });
  } catch (error) {
    console.error('[Reminders API] Error:', error);
    return NextResponse.json(
      { success: false, message: 'Internal server error' },
      { status: 500 }
    );
  }
}

// Manual trigger for testing (POST request) — requires the same cron secret
export async function POST(request: Request) {
  try {
    if (!isAuthorized(request)) {
      return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 401 });
    }
    const result = await handleRemindersRequest();
    
    return NextResponse.json(result, {
      status: result.success ? 200 : 500,
    });
  } catch (error) {
    console.error('[Reminders API] Error:', error);
    return NextResponse.json(
      { success: false, message: 'Internal server error' },
      { status: 500 }
    );
  }
}

// ── Cron auth ────────────────────────────────────────────────
// Vercel Cron cannot send custom headers, so the secret is accepted either
// as `Authorization: Bearer <CRON_SECRET>` or as a `?secret=` query param.
// Configure CRON_SECRET on the server and in the cron job URL.
// If CRON_SECRET is not set, the route refuses requests in production
// (so a missing env var fails closed instead of leaving it open).
function isAuthorized(request: Request): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    return process.env.NODE_ENV !== 'production';
  }
  const header = request.headers.get('authorization');
  const querySecret = new URL(request.url).searchParams.get('secret');
  return header === `Bearer ${secret}` || querySecret === secret;
}