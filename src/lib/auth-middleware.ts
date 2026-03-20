/**
 * Server-Side Authentication Middleware for WorshipCenter
 * Provides JWT validation and user extraction for API routes
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import type { User } from '@/lib/types';

// Lazy initialization of Supabase admin client for server-side operations
let supabaseAdmin: SupabaseClient | null = null;

const getSupabaseAdmin = (): SupabaseClient => {
  if (!supabaseAdmin) {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    
    if (!supabaseUrl || !serviceRoleKey) {
      console.warn('Missing Supabase environment variables');
      return null as any as SupabaseClient;
    }
    
    supabaseAdmin = createClient(supabaseUrl, serviceRoleKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: true,
      },
    });
  }
  
  return supabaseAdmin;
};

// User payload extracted from JWT
interface DecodedToken {
  sub: string;  // User ID
  email: string;
  role: string;
  church_id: string;
  iat: number;  // Issued at time
  exp?: number;
}

interface AuthResult {
  success: boolean;
  user: User | null;
  error?: string;
}

/**
 * Extract and verify JWT token from Authorization header
 */
export async function verifyAuthToken(authHeader: string | null): Promise<AuthResult> {
  // Check for header
  if (!authHeader) {
    return { success: false, user: null, error: 'Missing authorization header' };
  }
  
  // Extract Bearer token
  const token = authHeader.replace('Bearer ', '');
  if (!token) {
    return { success: false, user: null, error: 'Invalid token format' };
  }
  
  try {
    const client = getSupabaseAdmin();
    if (!client) {
      return { success: false, user: null, error: 'Server configuration error' };
    }
    
    // Verify the JWT with Supabase
    const { data: { user }, error } = await client.auth.getUser(token);
    
    if (error || !user) {
      return { success: false, user: null, error: 'Invalid or expired token' };
    }
    
    // Get user profile with role
    const { data: profile, error: profileError } = await client
      .from('users')
      .select('*')
      .eq('id', user.id)
      .single();
    
    if (profileError || !profile) {
      return { success: false, user: null, error: 'User profile not found' };
    }
    
    return {
      success: true,
      user: {
        id: user.id,
        email: user.email ?? profile.email,
        role: profile.role,
        church_id: profile.church_id,
      } as User,
    };
  } catch (err) {
    console.error('Auth middleware error:', err);
    return { success: false, user: null, error: 'Authentication failed' };
  }
}

/**
 * Higher-order function to wrap API route handlers with authentication
 */
export function withAuth(
  handler: (req: NextRequest, user: User) => Promise<NextResponse>
): (req: NextRequest) => Promise<NextResponse> {
  return async (req: NextRequest) => {
    const authHeader = req.headers.get('authorization');
    const authResult = await verifyAuthToken(authHeader);
    
    if (!authResult.success || !authResult.user) {
      return NextResponse.json(
        { error: authResult.error || 'Unauthorized' },
        { status: 401 }
      );
    }
    
    return handler(req, authResult.user);
  };
}

/**
 * Middleware for role-based access control
 */
export function withRole(
  allowedRoles: string[],
  handler: (req: NextRequest, user: User) => Promise<NextResponse>
): (req: NextRequest) => Promise<NextResponse> {
  return async (req: NextRequest) => {
    const authHeader = req.headers.get('authorization');
    const authResult = await verifyAuthToken(authHeader);
    
    if (!authResult.success || !authResult.user) {
      return NextResponse.json(
        { error: authResult.error || 'Unauthorized' },
        { status: 401 }
      );
    }
    
    if (!allowedRoles.includes(authResult.user.role)) {
      return NextResponse.json(
        { error: 'Insufficient permissions' },
        { status: 403 }
      );
    }
    
    return handler(req, authResult.user);
  };
}

/**
 * Extract user from request (for use in route handlers)
 * Returns null if not authenticated
 */
export async function getRequestUser(req: NextRequest): Promise<User | null> {
  const authHeader = req.headers.get('authorization');
  const authResult = await verifyAuthToken(authHeader);
  
  if (!authResult.success || !authResult.user) {
    return null;
  }
  
  return authResult.user;
}

/**
 * Validate that user belongs to specified church
 */
export async function validateChurchAccess(
  user: User,
  churchId: string
): Promise<boolean> {
  if (!user || !churchId) return false;
  
  // User must belong to the church
  if (user.church_id !== churchId) {
    return false;
  }
  
  return true;
}

/**
 * Rate limiting helper (in-memory, for production use Redis)
 * Simple implementation for basic rate limiting
 */
const rateLimitStore = new Map<string, { count: number; resetAt: number }>();

export function checkRateLimit(
  identifier: string,
  maxRequests: number = 5,
  windowMs: number = 60000 // 1 minute
): { allowed: boolean; remaining: number; resetAt: number } {
  const now = Date.now();
  const record = rateLimitStore.get(identifier);
  
  if (!record) {
    rateLimitStore.set(identifier, { count: 1, resetAt: now + windowMs });
    return { allowed: true, remaining: maxRequests - 1, resetAt: now + windowMs };
  }
  
  // Check if window has expired
  if (now > record.resetAt) {
    rateLimitStore.set(identifier, { count: 1, resetAt: now + windowMs });
    return { allowed: true, remaining: maxRequests - 1, resetAt: now + windowMs };
  }
  
  // Window is active, increment count
  record.count++;
  const allowed = record.count <= maxRequests;
  
  return {
    allowed,
    remaining: Math.max(0, maxRequests - record.count),
    resetAt: record.resetAt,
  };
}

/**
 * Clear rate limit for an identifier (for testing)
 */
export function clearRateLimit(identifier: string): void {
  rateLimitStore.delete(identifier);
}

/**
 * Sanitize request body inputs
 */
export function sanitizeRequestBody<T extends Record<string, unknown>>(body: T): T {
  const sanitized: Record<string, unknown> = {};
  
  for (const [key, value] of Object.entries(body)) {
    if (typeof value === 'string') {
      // Basic XSS prevention
      sanitized[key] = value
        .replace(/</g, '<')
        .replace(/>/g, '>')
        .replace(/"/g, '"')
        .replace(/'/g, '&#x27;')
        .replace(/`/g, '&#x60;')
        // Remove null bytes
        .replace(/\x00/g, '');
    } else if (typeof value === 'object' && value !== null) {
      sanitized[key] = sanitizeRequestBody(value as Record<string, unknown>);
    } else {
      sanitized[key] = value;
    }
  }
  
  return sanitized as T;
}