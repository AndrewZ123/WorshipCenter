/**
 * usePermissions Hook for WorshipCenter
 * Provides client-side permission checking based on user role
 */

import { useAuth } from '@/lib/auth';
import { hasPermission, canAccess, checkPermission, type Role, type Resource, type Action } from '@/lib/rbac';

/**
 * Hook for checking user permissions
 */
export function usePermissions() {
  const { user } = useAuth();
  const userRole = (user?.role as Role) || 'team';

  /**
   * Check if user can perform an action on a resource
   */
  const can = (resource: Resource, action: Action): boolean => {
    if (!user) return false;
    return hasPermission(userRole, resource, action);
  };

  /**
   * Check if user can access a resource (any action)
   */
  const canAccessResource = (resource: Resource): boolean => {
    if (!user) return false;
    return canAccess(userRole, resource);
  };

  /**
   * Get detailed permission check
   */
  const check = (resource: Resource, action: Action) => {
    if (!user) {
      return { allowed: false, reason: 'Not authenticated' };
    }
    return checkPermission(userRole, resource, action);
  };

  /**
   * Check if user is admin
   */
  const isAdmin = userRole === 'admin';

  /**
   * Check if user is leader or above
   */
  const isLeader = ['admin', 'leader'].includes(userRole);

  /**
   * Get current user role
   */
  const role = userRole;

  return {
    can,
    canAccessResource,
    check,
    isAdmin,
    isLeader,
    role,
    user,
  };
}