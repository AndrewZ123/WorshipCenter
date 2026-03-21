import { NextResponse } from 'next/server';

export async function GET() {
  const config = {
    RESEND_API_KEY: {
      exists: !!process.env.RESEND_API_KEY,
      startsWith: process.env.RESEND_API_KEY?.substring(0, 10) + '...',
    },
    EMAIL_FROM: {
      exists: !!process.env.EMAIL_FROM,
      value: process.env.EMAIL_FROM || 'not set',
    },
    NEXT_PUBLIC_APP_URL: {
      exists: !!process.env.NEXT_PUBLIC_APP_URL,
      value: process.env.NEXT_PUBLIC_APP_URL || 'not set',
    },
  };

  return NextResponse.json({
    environment: process.env.NODE_ENV,
    emailConfig: config,
    isConfigured: !!(process.env.RESEND_API_KEY && process.env.EMAIL_FROM),
  });
}