/**
 * Debug endpoint to check email configuration
 * This helps diagnose why emails might not be sending
 */

import { NextResponse } from 'next/server';

export async function GET() {
  // Only allow in production with proper auth check could be added
  // For now, this just checks configuration without exposing secrets
  
  const resendApiKey = process.env.RESEND_API_KEY;
  const emailFrom = process.env.EMAIL_FROM;
  
  const diagnostics = {
    timestamp: new Date().toISOString(),
    email: {
      resendConfigured: !!resendApiKey,
      resendKeyPrefix: resendApiKey ? `${resendApiKey.substring(0, 6)}...` : null,
      resendKeyLength: resendApiKey?.length || 0,
      emailFromConfigured: !!emailFrom,
      emailFromValue: emailFrom || null,
      fullyConfigured: !!(resendApiKey && emailFrom),
    },
    instructions: {
      step1: 'Create a Resend account at https://resend.com',
      step2: 'Verify your domain at https://resend.com/domains',
      step3: 'Create an API key at https://resend.com/api-keys',
      step4: 'Add RESEND_API_KEY to Vercel environment variables',
      step5: 'Add EMAIL_FROM to Vercel environment variables (e.g., no-reply@yourdomain.com)',
      step6: 'Redeploy your application',
    },
    missing: [] as string[],
  };
  
  if (!resendApiKey) {
    diagnostics.missing.push('RESEND_API_KEY');
  }
  
  if (!emailFrom) {
    diagnostics.missing.push('EMAIL_FROM');
  }
  
  return NextResponse.json(diagnostics);
}