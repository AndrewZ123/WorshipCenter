/**
 * GET /api/health
 *
 * Shallow liveness check for a free uptime monitor. Deliberately does no
 * authentication, database work, or configuration inspection: if the process
 * can answer, it is up. The response carries no environment, version,
 * dependency, or error details.
 *
 * Rate limited per client IP so the open endpoint cannot be used to hammer
 * the app. Uptime monitors polling once a minute stay far below the limit.
 */

import { NextRequest, NextResponse } from 'next/server';
import { checkRateLimit, getClientIp, rateLimitResponse } from '@/lib/auth-middleware';

const HEALTH_RATE_LIMIT = 30;
const HEALTH_RATE_WINDOW_MS = 60 * 1000;

export async function GET(request: NextRequest) {
  const limit = checkRateLimit(
    `health:${getClientIp(request)}`,
    HEALTH_RATE_LIMIT,
    HEALTH_RATE_WINDOW_MS
  );

  if (!limit.allowed) {
    return rateLimitResponse(limit);
  }

  return NextResponse.json(
    { ok: true },
    {
      status: 200,
      headers: {
        'Cache-Control': 'no-store, no-cache, must-revalidate',
      },
    }
  );
}
