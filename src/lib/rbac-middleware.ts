import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from './supabase';
import { hasPermission, Role, Resource, Action } from './rbac';

/**
 * Authentication and authorization middleware with RBAC enforcement
 * This prevents privilege escalation attacks
 */
export async function authenticate(
  request: NextRequest
): Promise<{ user: any; churchId: string; role: string } | NextResponse> {
  const token = request.headers.get('authorization')?.replace('Bearer ', '');
  
  if (!token) {
    return NextResponse.json(
      { error: 'Authentication required' },
      { status: 401 }
    );
  }

  const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(token);
  
  if (authError || !user) {
    return NextResponse.json(
      { error: 'Invalid or expired session' },
      { status: 401 }
    );
  }

  const { data: profile, error: profileError } = await supabaseAdmin
    .from('users')
    .select('church_id, role')
    .eq('id', user.id)
    .single();

  if (profileError || !profile) {
    return NextResponse.json(
      { error: 'User not found' },
      { status: 404 }
    );
  }

  return {
    user,
    churchId: profile.church_id,
    role: profile.role || 'team' // Default to team if no role set
  };
}

/**
 * Require specific permission for a resource and action
 */
export async function requirePermission(
  request: NextRequest,
  resource: Resource,
  action: Action
): Promise<{ user: any; churchId: string; role: string } | NextResponse> {
  const authResult = await authenticate(request);
  
  // If authentication failed, return that response
  if (authResult instanceof NextResponse) {
    return authResult;
  }

  const { user, churchId, role } = authResult;

  // Check if user has required permission
  if (!hasPermission(role as Role, resource, action)) {
    // Log unauthorized access attempt
    console.warn(`Unauthorized access attempt: User ${user.id} (role: ${role}) attempted ${action} on ${resource}`);
    
    return NextResponse.json(
      { 
        error: 'Insufficient permissions',
        required: { resource, action },
        yourRole: role
      },
      { status: 403 }
    );
  }

  return { user, churchId, role };
}

/**
 * Require admin role
 */
export async function requireAdmin(
  request: NextRequest
): Promise<{ user: any; churchId: string; role: string } | NextResponse> {
  const authResult = await authenticate(request);
  
  if (authResult instanceof NextResponse) {
    return authResult;
  }

  const { user, churchId, role } = authResult;

  // Check if user is admin
  if (role !== 'admin') {
    console.warn(`Admin access attempt denied: User ${user.id} (role: ${role})`);
    
    return NextResponse.json(
      { 
        error: 'Admin access required',
        yourRole: role
      },
      { status: 403 }
    );
  }

  return { user, churchId, role };
}

/**
 * Check if user can access a specific church's data
 * This enforces multi-tenant isolation
 */
export async function requireChurchAccess(
  request: NextRequest,
  targetChurchId: string
): Promise<{ user: any; churchId: string; role: string } | NextResponse> {
  const authResult = await authenticate(request);
  
  if (authResult instanceof NextResponse) {
    return authResult;
  }

  const { user, churchId, role } = authResult;

  // Admins can access any church (if you have super-admin functionality)
  // Otherwise, users can only access their own church
  if (churchId !== targetChurchId && role !== 'admin') {
    console.warn(`Cross-church access attempt: User ${user.id} (church: ${churchId}) attempted to access church ${targetChurchId}`);
    
    return NextResponse.json(
      { error: 'Access denied. You can only access your own church data.' },
      { status: 403 }
    );
  }

  return { user, churchId, role };
}

/**
 * Middleware wrapper for API routes
 */
export function withAuth(
  handler: (request: NextRequest, context: { user: any; churchId: string; role: string }) => Promise<NextResponse>
) {
  return async (request: NextRequest, { params }: { params?: any } = {}) => {
    const authResult = await authenticate(request);
    
    if (authResult instanceof NextResponse) {
      return authResult;
    }

    return handler(request, authResult);
  };
}

/**
 * Middleware wrapper for permission-required API routes
 */
export function withPermission(
  resource: Resource,
  action: Action,
  handler: (request: NextRequest, context: { user: any; churchId: string; role: string }) => Promise<NextResponse>
) {
  return async (request: NextRequest, { params }: { params?: any } = {}) => {
    const authResult = await requirePermission(request, resource, action);
    
    if (authResult instanceof NextResponse) {
      return authResult;
    }

    return handler(request, authResult);
  };
}

/**
 * Middleware wrapper for admin-only routes
 */
export function withAdmin(
  handler: (request: NextRequest, context: { user: any; churchId: string; role: string }) => Promise<NextResponse>
) {
  return async (request: NextRequest, { params }: { params?: any } = {}) => {
    const authResult = await requireAdmin(request);
    
    if (authResult instanceof NextResponse) {
      return authResult;
    }

    return handler(request, authResult);
  };
}
