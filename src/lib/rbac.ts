/**
 * Role-Based Access Control (RBAC) System for WorshipCenter
 * Defines permissions matrix and access control utilities
 * 
 * ─── Permission Model ─────────────────────────────────────────
 * The base RBAC matrix (PERMISSIONS) defines what each role
 * (admin, leader, team) can do with each resource.
 * 
 * For admin users, granular scopes from the admin_permissions
 * table can further restrict access. hasScopePermission()
 * checks both layers:
 *   1. If role !== 'admin' → use base RBAC matrix only
 *   2. If role === 'admin' → check admin_permissions scopes
 *      (admins start with all scopes = TRUE by default)
 */

// Role definitions
export type Role = 'admin' | 'leader' | 'team';

// Resource definitions
export type Resource = 
  | 'services'
  | 'songs'
  | 'team'
  | 'templates'
  | 'chat'
  | 'settings'
  | 'billing'
  | 'usage';

// Action definitions
export type Action = 'create' | 'read' | 'update' | 'delete' | 'manage';

// Permission matrix: role -> resource -> actions
const PERMISSIONS: Record<Role, Record<Resource, Action[]>> = {
  admin: {
    services: ['create', 'read', 'update', 'delete', 'manage'],
    songs: ['create', 'read', 'update', 'delete', 'manage'],
    team: ['create', 'read', 'update', 'delete', 'manage'],
    templates: ['create', 'read', 'update', 'delete', 'manage'],
    chat: ['create', 'read', 'update', 'delete'],
    settings: ['read', 'update', 'manage'],
    billing: ['read', 'update', 'manage'],
    usage: ['read'],
  },
  leader: {
    services: ['create', 'read', 'update', 'delete'],
    songs: ['create', 'read', 'update', 'delete'],
    team: ['read', 'update'],
    templates: ['create', 'read', 'update', 'delete'],
    chat: ['create', 'read', 'update'],
    settings: ['read'],
    billing: ['read'],
    usage: ['read'],
  },
  team: {
    services: ['read'],
    songs: ['read'],
    team: ['read'],
    templates: ['read'],
    chat: ['create', 'read'],
    settings: [],
    billing: [],
    usage: [],
  },
};

/**
 * Check if a role has permission to perform an action on a resource
 */
export function hasPermission(
  role: Role,
  resource: Resource,
  action: Action
): boolean {
  const rolePermissions = PERMISSIONS[role];
  if (!rolePermissions) return false;
  
  const resourcePermissions = rolePermissions[resource];
  if (!resourcePermissions) return false;
  
  return resourcePermissions.includes(action);
}

/**
 * Get all permissions for a role
 */
export function getRolePermissions(role: Role): Record<Resource, Action[]> {
  return PERMISSIONS[role] || {};
}

/**
 * Check if user can access a resource (any action)
 */
export function canAccess(role: Role, resource: Resource): boolean {
  const permissions = PERMISSIONS[role]?.[resource];
  return permissions ? permissions.length > 0 : false;
}

/**
 * Get roles that can perform an action on a resource
 */
export function getRolesForAction(resource: Resource, action: Action): Role[] {
  const roles: Role[] = [];
  
  for (const [role, resources] of Object.entries(PERMISSIONS)) {
    if (resources[resource]?.includes(action)) {
      roles.push(role as Role);
    }
  }
  
  return roles;
}

/**
 * Role hierarchy for comparison
 */
const ROLE_HIERARCHY: Record<Role, number> = {
  admin: 3,
  leader: 2,
  team: 1,
};

/**
 * Check if a role has equal or higher level than required
 */
export function hasRoleLevel(userRole: Role, requiredRole: Role): boolean {
  return ROLE_HIERARCHY[userRole] >= ROLE_HIERARCHY[requiredRole];
}

/**
 * Get the highest role from a list
 */
export function getHighestRole(roles: Role[]): Role | null {
  if (roles.length === 0) return null;
  
  let highest: Role = roles[0];
  for (const role of roles) {
    if (ROLE_HIERARCHY[role] > ROLE_HIERARCHY[highest]) {
      highest = role;
    }
  }
  
  return highest;
}

/**
 * Validate a role string
 */
export function isValidRole(role: string): role is Role {
  return ['admin', 'leader', 'team'].includes(role);
}

/**
 * Permission check result with details
 */
export interface PermissionCheckResult {
  allowed: boolean;
  reason?: string;
  requiredRole?: Role;
}

/**
 * Detailed permission check with explanation
 */
export function checkPermission(
  role: Role,
  resource: Resource,
  action: Action
): PermissionCheckResult {
  if (!isValidRole(role)) {
    return { allowed: false, reason: 'Invalid role' };
  }
  
  const allowed = hasPermission(role, resource, action);
  
  if (!allowed) {
    const requiredRoles = getRolesForAction(resource, action);
    return {
      allowed: false,
      reason: `Permission denied. Required role: ${requiredRoles.join(' or ')}`,
      requiredRole: requiredRoles[0],
    };
  }
  
  return { allowed: true };
}

/**
 * Check if user has access to a specific admin scope.
 * For admin users, this checks the admin_permissions table.
 * For non-admin users, this falls back to the base RBAC matrix.
 */
export function hasScopePermission(
  role: Role,
  adminPermissions: Record<string, boolean> | null | undefined,
  resource: Resource,
  action: Action
): boolean {
  // Non-admin users use base RBAC only
  if (role !== 'admin') {
    return hasPermission(role, resource, action);
  }

  // Admin without permissions row → default full access
  if (!adminPermissions) {
    return hasPermission(role, resource, action);
  }

  // Map resource to permission scope key
  const scopeMap: Partial<Record<Resource, string>> = {
    services: 'manage_services',
    songs: 'manage_songs',
    team: 'manage_team',
    templates: 'manage_templates',
    settings: 'manage_settings',
    billing: 'manage_billing',
    chat: 'manage_chat',
  };

  const scope = scopeMap[resource];
  if (!scope) {
    // Unmapped resources (e.g., usage) — fall back to base RBAC
    return hasPermission(role, resource, action);
  }

  // Check if the admin has this scope enabled
  if (adminPermissions[scope] === false) {
    return false;
  }

  return hasPermission(role, resource, action);
}

export default {
  hasPermission,
  getRolePermissions,
  canAccess,
  getRolesForAction,
  hasRoleLevel,
  getHighestRole,
  isValidRole,
  checkPermission,
  hasScopePermission,
  PERMISSIONS,
};