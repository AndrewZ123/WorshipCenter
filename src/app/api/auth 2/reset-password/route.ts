import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { env } from '@/lib/env';
import { checkRateLimit, sanitizeRequestBody } from '@/lib/auth-middleware';

/**
 * Rate limit password reset requests to prevent abuse
 */
const MAX_RESET_ATTEMPTS = 3;
const RESET_WINDOW_MS = 15 * 60 * 1000; // 15 minutes

export async function POST(request: NextRequest) {
  try {
    // Parse and validate request body
    const body = await request.json();
    const sanitized = sanitizeRequestBody(body);
    const { email } = sanitized;

    // Validate email
    if (!email || typeof email !== 'string') {
      return NextResponse.json(
        { error: 'Email is required' },
        { status: 400 }
      );
    }

    // Basic email format validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return NextResponse.json(
        { error: 'Invalid email format' },
        { status: 400 }
      );
    }

    // Rate limiting by email
    const rateLimit = checkRateLimit(
      `reset-password-${email.toLowerCase()}`,
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
