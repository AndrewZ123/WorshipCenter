/**
 * Email Service Configuration
 * 
 * This module handles email sending via Resend
 */

import { Resend } from 'resend';

let resendClient: Resend | null = null;

/**
 * Initialize Resend client if API key is configured
 */
function getResendClient(): Resend | null {
  if (resendClient) {
    return resendClient;
  }

  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    console.warn('[Email] RESEND_API_KEY not configured - emails will not be sent');
    return null;
  }

  resendClient = new Resend(apiKey);
  return resendClient;
}

/**
 * Check if email service is configured
 */
export function isEmailConfigured(): boolean {
  return !!process.env.RESEND_API_KEY && !!process.env.EMAIL_FROM;
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
  const client = getResendClient();
  const from = process.env.EMAIL_FROM;

  if (!client || !from) {
    console.warn('[Email] Email service not configured - skipping email send');
    return { success: false, error: 'Email service not configured' };
  }

  try {
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