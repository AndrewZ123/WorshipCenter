// SMS Service - Abstraction layer for sending SMS messages
// Currently uses Twilio, but the abstraction allows for switching providers

import { Twilio } from 'twilio';
import { env } from '@/lib/env';

interface SMSSendOptions {
  to: string;
  body: string;
}

interface SMSResult {
  success: boolean;
  sid?: string;
  error?: string;
}

// Initialize Twilio client if credentials are available
let twilioClient: Twilio | null = null;

if (env.twilioAccountSid() && env.twilioAuthToken()) {
  try {
    twilioClient = new Twilio(env.twilioAccountSid(), env.twilioAuthToken());
    console.log('[SMS] Twilio client initialized successfully');
  } catch (error) {
    console.error('[SMS] Failed to initialize Twilio client:', error);
  }
} else {
  console.warn('[SMS] Twilio credentials not configured. SMS sending will be disabled.');
}

/**
 * Send an SMS message
 * @param options - The SMS send options
 * @returns Promise with success status and optional SID or error
 */
export async function sendSMS(options: SMSSendOptions): Promise<SMSResult> {
  if (!twilioClient) {
    console.warn('[SMS] Cannot send SMS: Twilio client not initialized');
    return { success: false, error: 'SMS service not configured' };
  }

  if (!env.twilioPhoneNumber()) {
    console.warn('[SMS] Cannot send SMS: Twilio phone number not configured');
    return { success: false, error: 'Sender phone number not configured' };
  }

  try {
    const message = await twilioClient.messages.create({
      body: options.body,
      from: env.twilioPhoneNumber(),
      to: options.to,
    });

    console.log('[SMS] Message sent successfully:', message.sid);
    return { success: true, sid: message.sid };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('[SMS] Failed to send message:', errorMessage);
    return { success: false, error: errorMessage };
  }
}

/**
 * Check if SMS service is available
 * @returns true if SMS service is configured and ready
 */
export function isSMSAvailable(): boolean {
  return twilioClient !== null && !!env.twilioPhoneNumber();
}

/**
 * Format phone number to E.164 format
 * This ensures phone numbers are in the correct format for Twilio
 * @param phone - The phone number to format
 * @returns Formatted phone number or original if parsing fails
 */
export function formatPhoneNumber(phone: string): string {
  // Remove all non-numeric characters
  const cleaned = phone.replace(/\D/g, '');
  
  // If the number starts with 1 and is 11 digits, it's already in US format
  if (cleaned.length === 11 && cleaned.startsWith('1')) {
    return `+${cleaned}`;
  }
  
  // If the number is 10 digits, assume US format and add +1
  if (cleaned.length === 10) {
    return `+1${cleaned}`;
  }
  
  // If the number already starts with +, return as-is
  if (phone.startsWith('+')) {
    return phone;
  }
  
  // Otherwise, try to return the cleaned version with +
  return cleaned ? `+${cleaned}` : phone;
}

/**
 * Validate phone number format
 * @param phone - The phone number to validate
 * @returns true if the phone number appears valid
 */
export function validatePhoneNumber(phone: string): boolean {
  const cleaned = phone.replace(/\D/g, '');
  // Accept 10 digit US numbers or 11 digit with leading 1
  return cleaned.length === 10 || (cleaned.length === 11 && cleaned.startsWith('1'));
}