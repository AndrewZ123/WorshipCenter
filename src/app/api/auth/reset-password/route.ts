import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

/**
 * Validates and normalizes the application URL to ensure it's production-ready
 */
function getProductionUrl(): string {
  // Priority 1: Environment variable (most reliable in production)
  const envUrl = process.env.NEXT_PUBLIC_APP_URL;
  
  // Priority 2: Request origin (fallback for edge cases)
  const requestOrigin = process.env.VERCEL_URL 
    ? `https://${process.env.VERCEL_URL}` 
    : null;
  
  // Priority 3: Hardcoded production URL (last resort)
  const productionUrl = 'https://app.worshipcenter.app';
  
  const finalUrl = envUrl || requestOrigin || productionUrl;
  
  // Log the URL resolution chain for debugging
  console.log('[Reset Password API] URL Resolution:');
  console.log('  - NEXT_PUBLIC_APP_URL:', envUrl || 'NOT SET');
  console.log('  - VERCEL_URL:', process.env.VERCEL_URL || 'NOT SET');
  console.log('  - Request Origin:', requestOrigin || 'N/A');
  console.log('  - Final URL:', finalUrl);
  console.log('  - Redirect URL:', `${finalUrl}/new-password`);
  
  return finalUrl;
}

/**
 * Validates that the URL is not localhost for production
 */
function isProductionUrl(url: string): boolean {
  return !url.includes('localhost') && 
         !url.includes('127.0.0.1') && 
         !url.includes('0.0.0.0');
}

export async function POST(request: NextRequest) {
  try {
    const { email } = await request.json();

    if (!email) {
      console.error('[Reset Password API] Validation failed: Email is required');
      return NextResponse.json(
        { error: 'Email is required' },
        { status: 400 }
      );
    }

    // Get and validate the production URL
    const appUrl = getProductionUrl();
    
    // Warn if we're about to use a localhost URL
    if (!isProductionUrl(appUrl)) {
      console.error('[Reset Password API] WARNING: Using non-production URL:', appUrl);
      console.error('[Reset Password API] This suggests NEXT_PUBLIC_APP_URL is not properly configured in production');
      console.error('[Reset Password API] Check Supabase Authentication > URL Configuration');
      
      // Still proceed but log the warning
    }

    console.log('[Reset Password API] Processing password reset request:');
    console.log('  - Email:', email);
    console.log('  - App URL:', appUrl);
    console.log('  - Redirect URL:', `${appUrl}/new-password`);

    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${appUrl}/new-password`,
    });

    if (error) {
      console.error('[Reset Password API] Supabase error:', error.message);
      console.error('[Reset Password API] Full error details:', JSON.stringify(error, null, 2));
      return NextResponse.json(
        { error: error.message },
        { status: 400 }
      );
    }

    console.log('[Reset Password API] Password reset email sent successfully to:', email);
    
    return NextResponse.json({ 
      success: true,
      redirectUrl: `${appUrl}/new-password`
    });
  } catch (error) {
    console.error('[Reset Password API] Unexpected exception:', error);
    return NextResponse.json(
      { error: 'An unexpected error occurred. Please try again.' },
      { status: 500 }
    );
  }
}
