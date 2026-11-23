import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { checkRateLimit, getClientIp, rateLimitResponse } from '@/lib/auth-middleware';
import { RateLimitTiers } from '@/lib/comprehensiveRateLimit';
import {
  actionFromInput,
  isPlausibleResponseToken,
  previewResponseToken,
  redeemResponseToken,
  RESPONSE_TOKEN_MAX_LENGTH,
  RESPONSE_TOKEN_MIN_LENGTH,
  ResponseTokenError,
} from '@/lib/assignment-response-tokens';

const TokenSchema = z
  .string()
  .min(RESPONSE_TOKEN_MIN_LENGTH)
  .max(RESPONSE_TOKEN_MAX_LENGTH)
  .regex(/^[A-Za-z0-9_-]+$/);

const RespondBodySchema = z.object({
  token: TokenSchema,
  action: z.enum(['confirm', 'decline']),
});

const INVALID_LINK_MESSAGE = 'This link is invalid or has expired.';

// Public endpoint: no authentication. The emailed token is the credential and
// is single-use. Never accept an assignment id from the request.
export async function POST(request: NextRequest) {
  const limit = checkRateLimit(
    `respond:${getClientIp(request)}`,
    RateLimitTiers.API_WRITE.requests,
    RateLimitTiers.API_WRITE.window
  );
  if (!limit.allowed) {
    return rateLimitResponse(limit);
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ ok: false, error: 'Invalid request' }, { status: 400 });
  }

  const parsed = RespondBodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ ok: false, error: 'Invalid request' }, { status: 400 });
  }

  try {
    const result = await redeemResponseToken(
      parsed.data.token,
      actionFromInput(parsed.data.action)
    );

    return NextResponse.json({
      ok: true,
      status: result.status,
      serviceTitle: result.serviceTitle,
      serviceDate: result.serviceDate,
      role: result.role,
    });
  } catch (error) {
    if (error instanceof ResponseTokenError && error.code === 'invalid') {
      return NextResponse.json(
        { ok: false, error: INVALID_LINK_MESSAGE },
        { status: 410 }
      );
    }

    console.error('[Assignment Respond] Error:', error);
    return NextResponse.json(
      { ok: false, error: 'Unable to process this link right now.' },
      { status: 500 }
    );
  }
}

// Read-only preview. Email link scanners usually prefetch GET requests, so this
// must never consume the token or change the assignment.
export async function GET(request: NextRequest) {
  const limit = checkRateLimit(
    `respond-preview:${getClientIp(request)}`,
    RateLimitTiers.API_READ.requests,
    RateLimitTiers.API_READ.window
  );
  if (!limit.allowed) {
    return rateLimitResponse(limit);
  }

  const token = request.nextUrl.searchParams.get('t');
  if (!isPlausibleResponseToken(token)) {
    return NextResponse.json({ valid: false });
  }

  try {
    const preview = await previewResponseToken(token);
    if (!preview.valid) {
      return NextResponse.json({ valid: false });
    }

    return NextResponse.json({
      valid: true,
      status: preview.status,
      serviceTitle: preview.serviceTitle,
      serviceDate: preview.serviceDate,
      role: preview.role,
    });
  } catch (error) {
    console.error('[Assignment Respond] Preview error:', error);
    return NextResponse.json({ valid: false });
  }
}
