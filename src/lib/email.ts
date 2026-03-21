/**
 * Email Service Configuration
 * 
 * This module handles email sending via Resend
 * Resend import is lazy to prevent module load failures if package isn't installed
 */

let Resend: any = null;

/**
 * Lazy load Resend to prevent module load failures
 */
async function loadResend() {
  if (Resend !== null) return Resend;
  
  try {
    const module = await import('resend');
    Resend = module.Resend;
    return Resend;
  } catch (error) {
    console.error('[Email] Failed to load Resend package:', error);
    return null;
  }
}

/**
 * Initialize Resend client if API key is configured
 * Wrapped in try-catch to prevent errors during initialization
 */
async function getResendClient(): Promise<any> {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    console.warn('[Email] RESEND_API_KEY not configured - emails will not be sent');
    return null;
  }

  try {
    const ResendClass = await loadResend();
    if (!ResendClass) {
      console.error('[Email] Resend package not available');
      return null;
    }
    
    const client = new ResendClass(apiKey);
    return client;
  } catch (error) {
    console.error('[Email] Failed to initialize Resend client:', error);
    return null;
  }
}

/**
 * Check if email service is configured
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

  try {
    const client = await getResendClient();
    if (!client) {
      console.warn('[Email] Resend client not available - skipping email send');
      return { success: false, error: 'Email service not configured (Resend not available)' };
    }

    const result = await client.emails.send({
      from,
      to,
      subject,
      html,
      text,
    });

    if (result.error) {
      console.error('[Email] Failed to send email:', result.error);
      return { success: false, error: result.error.message };
    }

    console.log('[Email] Email sent successfully:', result.data?.id);
    return { success: true, messageId: result.data?.id };
  } catch (error) {
    console.error('[Email] Error sending email:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}