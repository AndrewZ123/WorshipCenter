/**
 * Email Service Configuration
 * 
 * This module handles email sending via Resend
 * Using static import for reliability in production/Vercel environment
 */
import { Resend } from 'resend';

let resendClient: any = null;

/**
 * Initialize Resend client if API key is configured
 * Returns the same client instance for subsequent calls (singleton pattern)
 */
function getResendClient(): any {
  // Return cached client if already initialized
  if (resendClient !== null) {
    return resendClient;
  }

  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    console.warn('[Email] RESEND_API_KEY not configured - emails will not be sent');
    return null;
  }

  try {
    console.log('[Email] Initializing Resend client');
    resendClient = new Resend(apiKey);
    console.log('[Email] Resend client initialized successfully');
    return resendClient;
  } catch (error) {
    console.error('[Email] Failed to initialize Resend client:', error);
    resendClient = null;
    return null;
  }
}

/**
 * Check if email service is configured
 * @returns Object with configuration status and details
 */
export async function isEmailConfigured(): Promise<boolean> {
  const hasApiKey = !!process.env.RESEND_API_KEY;
  const hasFromEmail = !!process.env.EMAIL_FROM;
  
  if (!hasApiKey || !hasFromEmail) {
    console.warn('[Email] Email service not fully configured:', {
      hasApiKey,
      hasFromEmail,
      emailFrom: process.env.EMAIL_FROM ? `${process.env.EMAIL_FROM.substring(0, 5)}...` : 'missing'
    });
  }
  
  return hasApiKey && hasFromEmail;
}

/**
 * Get detailed email configuration status for debugging
 * @returns Object with detailed configuration status
 */
export function getEmailConfigStatus(): {
  configured: boolean;
  hasApiKey: boolean;
  hasFromEmail: boolean;
  emailFrom: string | null;
  missingVariables: string[];
  instructions: string;
} {
  const hasApiKey = !!process.env.RESEND_API_KEY;
  const hasFromEmail = !!process.env.EMAIL_FROM;
  const missingVariables: string[] = [];
  
  if (!hasApiKey) missingVariables.push('RESEND_API_KEY');
  if (!hasFromEmail) missingVariables.push('EMAIL_FROM');
  
  return {
    configured: hasApiKey && hasFromEmail,
    hasApiKey,
    hasFromEmail,
    emailFrom: process.env.EMAIL_FROM || null,
    missingVariables,
    instructions: missingVariables.length > 0 
      ? `Add the following environment variables to Vercel: ${missingVariables.join(', ')}. See https://resend.com for setup instructions.`
      : 'Email service is fully configured.',
  };
}

/**
 * Send an email using Resend
 * @param to - Recipient email address
 * @param subject - Email subject
 * @param html - Email HTML content
 * @param text - Plain text fallback
 * @returns Promise with send result
 */
export async function sendEmail({
  to,
  subject,
  html,
  text,
}: {
  to: string;
  subject: string;
  html: string;
  text: string;
}): Promise<{ success: boolean; error?: string; messageId?: string }> {
  const from = process.env.EMAIL_FROM;

  if (!from) {
    console.warn('[Email] EMAIL_FROM not configured - skipping email send');
    return { success: false, error: 'Email service not configured (missing EMAIL_FROM)' };
  }

  console.log('[Email] Preparing to send email:', { to, subject });

  try {
    const client = getResendClient();
    if (!client) {
      console.error('[Email] Resend client initialization failed - check RESEND_API_KEY');
      return { success: false, error: 'Email service not configured (Resend client failed to initialize)' };
    }

    console.log('[Email] Sending email via Resend...');
    const result = await client.emails.send({
      from,
      to,
      subject,
      html,
      text,
    });

    if (result.error) {
      console.error('[Email] Resend API returned error:', {
        message: result.error.message,
        statusCode: result.error.statusCode,
        name: result.error.name,
      });
      return { success: false, error: result.error.message };
    }

    console.log('[Email] Email sent successfully:', {
      messageId: result.data?.id,
      to,
      subject,
    });
    return { success: true, messageId: result.data?.id };
  } catch (error) {
    console.error('[Email] Unexpected error sending email:', {
      error: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined,
      to,
      subject,
    });
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error occurred while sending email',
    };
  }
}
