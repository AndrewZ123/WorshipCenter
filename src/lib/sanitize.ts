/**
 * Input Sanitization Utilities for WorshipCenter
 * Provides XSS protection and input validation for all user inputs
 */

import DOMPurify from 'isomorphic-dompurify';

// Configure DOMPurify to be strict
DOMPurify.setConfig({
  ALLOWED_TAGS: [], // Strip all HTML tags by default
  ALLOWED_ATTR: [], // Strip all attributes
  KEEP_CONTENT: true, // Keep text content
});

/**
 * Sanitize a string input to prevent XSS attacks
 * Strips all HTML tags and normalizes whitespace
 */
export function sanitizeString(input: string): string {
  if (typeof input !== 'string') return '';
  
  // First pass: DOMPurify strips HTML
  let sanitized = DOMPurify.sanitize(input);
  
  // Normalize unicode and trim
  sanitized = sanitized.normalize('NFC').trim();
  
  // Remove null bytes and other control characters (except newlines/tabs)
  sanitized = sanitized.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '');
  
  return sanitized;
}

/**
 * Sanitize HTML content for safe display
 * Allows a restricted set of safe HTML tags
 */
export function sanitizeHtml(input: string): string {
  if (typeof input !== 'string') return '';
  
  // Configure for limited HTML
  const clean = DOMPurify.sanitize(input, {
    ALLOWED_TAGS: ['b', 'i', 'em', 'strong', 'u', 'br', 'p', 'span'],
    ALLOWED_ATTR: [],
    KEEP_CONTENT: true,
  });
  
  return clean;
}

/**
 * Sanitize an email address
 * Returns empty string if invalid
 */
export function sanitizeEmail(email: string): string {
  if (typeof email !== 'string') return '';
  
  // Basic sanitization
  const cleaned = sanitizeString(email).toLowerCase().trim();
  
  // Validate email format
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(cleaned)) {
    return '';
  }
  
  // Limit length
  if (cleaned.length > 254) {
    return '';
  }
  
  return cleaned;
}

/**
 * Validate an email address without sanitizing
 */
export function isValidEmail(email: string): boolean {
  if (typeof email !== 'string') return false;
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email) && email.length <= 254;
}

/**
 * Validate a UUID string
 */
export function isValidUUID(uuid: string): boolean {
  if (typeof uuid !== 'string') return false;
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  return uuidRegex.test(uuid);
}

/**
 * Sanitize a UUID string
 * Returns empty string if invalid
 */
export function sanitizeUUID(uuid: string): string {
  if (!isValidUUID(uuid)) return '';
  return uuid.toLowerCase();
}

/**
 * Sanitize a phone number
 * Removes all non-numeric characters except + and -
 */
export function sanitizePhone(phone: string): string {
  if (typeof phone !== 'string') return '';
  
  // Keep only digits, +, and -
  const cleaned = phone.replace(/[^\d+\-\s()]/g, '').trim();
  
  // Limit length
  if (cleaned.length > 20) {
    return cleaned.substring(0, 20);
  }
  
  return cleaned;
}

/**
 * Sanitize a URL string
 * Only allows http, https, and mailto protocols
 */
export function sanitizeUrl(url: string): string {
  if (typeof url !== 'string') return '';
  
  const trimmed = url.trim();
  
  // Check for allowed protocols
  const allowedProtocols = ['http://', 'https://', 'mailto:', '/', '#'];
  const hasValidProtocol = allowedProtocols.some(p => 
    trimmed.toLowerCase().startsWith(p)
  );
  
  // Block javascript: and other dangerous protocols
  const dangerousProtocols = ['javascript:', 'data:', 'vbscript:', 'file:'];
  const hasDangerousProtocol = dangerousProtocols.some(p =>
    trimmed.toLowerCase().startsWith(p)
  );
  
  if (hasDangerousProtocol) {
    return '';
  }
  
  // Allow relative URLs and valid protocols
  if (!hasValidProtocol && !trimmed.startsWith('/')) {
    return '';
  }
  
  return trimmed;
}

/**
 * Sanitize a numeric string
 */
export function sanitizeNumber(value: string): string {
  if (typeof value !== 'string') return '';
  // Keep only digits, decimal point, and negative sign
  return value.replace(/[^\d.\-]/g, '');
}

/**
 * Sanitize a date string (ISO format)
 */
export function sanitizeDate(date: string): string {
  if (typeof date !== 'string') return '';
  
  // Check for ISO date format YYYY-MM-DD
  const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
  if (dateRegex.test(date)) {
    return date;
  }
  
  // Check for ISO datetime format
  const datetimeRegex = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/;
  if (datetimeRegex.test(date)) {
    return date.substring(0, 19); // Truncate to remove timezone etc.
  }
  
  return '';
}

/**
 * Sanitize a time string (HH:mm format)
 */
export function sanitizeTime(time: string): string {
  if (typeof time !== 'string') return '';
  
  // Check for HH:mm format
  const timeRegex = /^([01]?\d|2[0-3]):([0-5]\d)$/;
  if (timeRegex.test(time)) {
    return time;
  }
  
  return '';
}

/**
 * Sanitize object recursively
 * Applies string sanitization to all string values in an object
 */
export function sanitizeObject<T extends Record<string, unknown>>(obj: T): T {
  if (!obj || typeof obj !== 'object') {
    return obj;
  }
  
  const sanitized: Record<string, unknown> = {};
  
  for (const [key, value] of Object.entries(obj)) {
    // Sanitize the key
    const sanitizedKey = sanitizeString(key);
    
    if (typeof value === 'string') {
      sanitized[sanitizedKey] = sanitizeString(value);
    } else if (Array.isArray(value)) {
      sanitized[sanitizedKey] = value.map(item => 
        typeof item === 'string' ? sanitizeString(item) :
        typeof item === 'object' && item !== null ? sanitizeObject(item as Record<string, unknown>) :
        item
      );
    } else if (typeof value === 'object' && value !== null) {
      sanitized[sanitizedKey] = sanitizeObject(value as Record<string, unknown>);
    } else {
      sanitized[sanitizedKey] = value;
    }
  }
  
  return sanitized as T;
}

/**
 * Sanitize form input specifically for database operations
 * Handles common form fields with appropriate sanitization
 */
export function sanitizeFormData<T extends Record<string, unknown>>(data: T): T {
  if (!data || typeof data !== 'object') {
    return data;
  }
  
  const sanitized: Record<string, unknown> = {};
  
  for (const [key, value] of Object.entries(data)) {
    const lowerKey = key.toLowerCase();
    
    if (typeof value === 'string') {
      // Apply field-specific sanitization
      if (lowerKey.includes('email')) {
        sanitized[key] = sanitizeEmail(value);
      } else if (lowerKey.includes('phone')) {
        sanitized[key] = sanitizePhone(value);
      } else if (lowerKey.includes('url') || lowerKey.includes('link')) {
        sanitized[key] = sanitizeUrl(value);
      } else if (lowerKey === 'id' || lowerKey.endsWith('_id')) {
        sanitized[key] = sanitizeUUID(value);
      } else if (lowerKey.includes('date')) {
        sanitized[key] = sanitizeDate(value);
      } else if (lowerKey.includes('time')) {
        sanitized[key] = sanitizeTime(value);
      } else {
        sanitized[key] = sanitizeString(value);
      }
    } else if (Array.isArray(value)) {
      sanitized[key] = value.map(item => 
        typeof item === 'string' ? sanitizeString(item) :
        typeof item === 'object' && item !== null ? sanitizeFormData(item as Record<string, unknown>) :
        item
      );
    } else if (typeof value === 'object' && value !== null) {
      sanitized[key] = sanitizeFormData(value as Record<string, unknown>);
    } else {
      sanitized[key] = value;
    }
  }
  
  return sanitized as T;
}

/**
 * Escape special characters for safe use in SQL LIKE queries
 * Note: Supabase parameterized queries already handle this, but this provides
 * additional protection for any raw query scenarios
 */
export function escapeLikePattern(pattern: string): string {
  if (typeof pattern !== 'string') return '';
  return pattern
    .replace(/\\/g, '\\\\')
    .replace(/%/g, '\\%')
    .replace(/_/g, '\\_');
}

/**
 * Truncate string to maximum length
 */
export function truncate(str: string, maxLength: number): string {
  if (typeof str !== 'string') return '';
  if (str.length <= maxLength) return str;
  return str.substring(0, maxLength);
}

/**
 * Validate and sanitize a role string
 */
const VALID_ROLES = ['admin', 'leader', 'team'] as const;
export type ValidRole = typeof VALID_ROLES[number];

export function sanitizeRole(role: string): ValidRole | null {
  if (typeof role !== 'string') return null;
  const normalized = role.toLowerCase().trim();
  if (VALID_ROLES.includes(normalized as ValidRole)) {
    return normalized as ValidRole;
  }
  return null;
}

/**
 * Validate and sanitize service status
 */
const VALID_STATUSES = ['draft', 'finalized', 'completed'] as const;
export type ValidStatus = typeof VALID_STATUSES[number];

export function sanitizeStatus(status: string): ValidStatus | null {
  if (typeof status !== 'string') return null;
  const normalized = status.toLowerCase().trim();
  if (VALID_STATUSES.includes(normalized as ValidStatus)) {
    return normalized as ValidStatus;
  }
  return null;
}

/**
 * Check if a string contains potential XSS patterns
 * Useful for logging and monitoring suspicious inputs
 */
export function containsXssPatterns(input: string): boolean {
  if (typeof input !== 'string') return false;
  
  const xssPatterns = [
    /<script\b/i,
    /javascript:/i,
    /on\w+\s*=/i,
    /data:/i,
    /vbscript:/i,
    /<iframe\b/i,
    /<object\b/i,
    /<embed\b/i,
    /<form\b/i,
    /expression\s*\(/i,
  ];
  
  return xssPatterns.some(pattern => pattern.test(input));
}

/**
 * Log suspicious input for security monitoring
 */
export function logSuspiciousInput(
  context: string, 
  input: string, 
  userId?: string
): void {
  if (containsXssPatterns(input)) {
    console.warn('[SECURITY] Suspicious input detected', {
      context,
      userId,
      inputLength: input.length,
      timestamp: new Date().toISOString(),
    });
  }
}

export default {
  sanitizeString,
  sanitizeHtml,
  sanitizeEmail,
  sanitizePhone,
  sanitizeUrl,
  sanitizeUUID,
  sanitizeNumber,
  sanitizeDate,
  sanitizeTime,
  sanitizeObject,
  sanitizeFormData,
  escapeLikePattern,
  truncate,
  sanitizeRole,
  sanitizeStatus,
  isValidEmail,
  isValidUUID,
  containsXssPatterns,
  logSuspiciousInput,
};