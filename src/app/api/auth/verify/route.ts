/**
 * Auth Verification API Route
 * Validates JWT tokens and returns user information
 */

import { NextRequest, NextResponse } from 'next/server';
import { verifyAuthToken, checkRateLimit } from '@/lib/auth-middleware';

export async function GET(request: NextRequest) {
  // Rate limiting by IP
  const ip = request.headers.get('x-forwarded-for') || 
             request.headers.get('x-real-ip') || 
             'unknown';
  
  const rateLimit = checkRateLimit(`auth-verify-${ip}`, 10, 60000);
  
  if (!rateLimit.allowed) {
    return NextResponse.json(
      { error: 'Too many requests', resetAt: rateLimit.resetAt },
      { 
        status: 429,
        headers: {
          'X-RateLimit-Remaining': rateLimit.remaining.toString(),
          'X-RateLimit-Reset': rateLimit.resetAt.toString(),
        }
      }
    );
  }
  
  const authHeader = request.headers.get('authorization');
  const authResult = await verifyAuthToken(authHeader);
  
  if (!authResult.success || !authResult.user) {
    return NextResponse.json(
      { error: authResult.error || 'Unauthorized' },
      { status: 401 }
    );
  }
  
  return NextResponse.json({
    user: {
      id: authResult.user.id,
      email: authResult.user.email,
      role: authResult.user.role,
      church_id: authResult.user.church_id,
    },
    authenticated: true,
  });
}