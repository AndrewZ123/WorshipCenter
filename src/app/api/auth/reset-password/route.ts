import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { env } from '@/lib/env';
import { checkRateLimit } from '@/lib/auth-middleware';
import { ResetPasswordRequestSchema, invalidInputResponse } from '@/lib/validation';

/**
 * Rate limit password reset requests to prevent abuse
 */
const MAX_RESET_ATTEMPTS = 3;
const RESET_WINDOW_MS = 15 * 60 * 1000; // 15 minutes

export async function POST(request: NextRequest) {
  try {
    // Parse and validate request body
    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return invalidInputResponse();
    }

    const parsed = ResetPasswordRequestSchema.safeParse(body);
    if (!parsed.success) {
      return invalidInputResponse();
    }

    const { email } = parsed.data;

    // Rate limiting by email
    const rateLimit = checkRateLimit(
      `reset-password-${email}`,
      MAX_RESET_ATTEMPTS,
      RESET_WINDOW_MS
    );

    if (!rateLimit.allowed) {
      return NextResponse.json(
        { 
          error: 'Too many password reset attempts. Please try again later.',
          resetAt: rateLimit.resetAt 
        },
        { 
          status: 429,
          headers: {
            'X-RateLimit-Remaining': rateLimit.remaining.toString(),
            'X-RateLimit-Reset': rateLimit.resetAt.toString(),
          }
        }
      );
    }

    // Get application URL from environment
    const appUrl = env.appUrl();

    // Use server-side Supabase client
    const supabase = createClient(
      env.supabaseUrl(),
      env.supabaseServiceRoleKey()
    );

    // Send password reset email
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${appUrl}/new-password`,
    });

    if (error) {
      // Don't expose whether email exists or not for security
      console.error('[Password Reset] Error:', error.message);
      return NextResponse.json(
        { 
          success: true,
          message: 'If an account exists with this email, you will receive a password reset link.'
        },
        { status: 200 }
      );
    }

    // Always return success to prevent email enumeration
    return NextResponse.json({ 
      success: true,
      message: 'If an account exists with this email, you will receive a password reset link.'
    });
  } catch (error) {
    console.error('[Password Reset] Unexpected error:', error);
    return NextResponse.json(
      { error: 'An unexpected error occurred. Please try again.' },
      { status: 500 }
    );
  }
}
