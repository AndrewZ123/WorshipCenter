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

export async function GET() {
  try {
    // Only allow calls from internal cron jobs (add authentication in production)
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

// Manual trigger for testing (POST request)
// In production, you may want to add authentication here
export async function POST() {
  try {
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