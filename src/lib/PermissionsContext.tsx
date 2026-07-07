'use client';

import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import { useAuth } from '@/lib/auth';
import { db } from '@/lib/store';
import type { AdminPermission } from '@/lib/types';
import type { Permissions, PermissionScope } from './permissions';

interface PermissionsContextType extends Permissions {
  /** Re-fetch permissions data from the server */
  refresh: () => Promise<void>;
}

const defaultPermissions: PermissionsContextType = {
  isAdmin: false,
  isVolunteer: true,
  can: () => false,
  loading: true,
  roleLabel: 'Team Member',
  refresh: async () => {},
};

const PermissionsContext = createContext<PermissionsContextType>(defaultPermissions);

export function PermissionsProvider({ children }: { children: React.ReactNode }) {
  const { user, church } = useAuth();
  const [adminPerms, setAdminPerms] = useState<AdminPermission | null>(null);
  const [loading, setLoading] = useState(true);
  const [roleLabel, setRoleLabel] = useState('Team Member');
  const fetchedRef = useRef<string | null>(null);

  const load = useCallback(async () => {
    if (!user || !church) {
      setAdminPerms(null);
      setRoleLabel('Team Member');
      setLoading(true);
      return;
    }

    // Avoid re-fetching for the same user
    const cacheKey = `${user.id}:${church.id}`;
    if (fetchedRef.current === cacheKey) return;

    fetchedRef.current = cacheKey;

    try {
      // Fetch admin permissions row
      const perms = await db.adminPermissions.getByUser(user.id);
      setAdminPerms(perms);

      // Fetch team member record for display role label
      if (user.team_member_id) {
        const members = await db.teamMembers.getByChurch(church.id);
        const myMember = members.find((m: any) => m.id === user.team_member_id);
        if (myMember && myMember.roles && myMember.roles.length > 0) {
          setRoleLabel(myMember.roles[0]);
        } else {
          setRoleLabel(user.role === 'admin' ? 'Admin' : 'Team Member');
        }
      } else {
        setRoleLabel(user.role === 'admin' ? 'Admin' : 'Team Member');
      }
    } catch (err) {
      console.error('[Permissions] Failed to load:', err);
    } finally {
      setLoading(false);
    }
  }, [user, church]);

  useEffect(() => {
    fetchedRef.current = null;
    load();
  }, [user?.id, church?.id, load]);

  const isAdmin = user?.role === 'admin';
  const isVolunteer = user?.role !== 'admin';

  const can = useCallback(
    (scope: PermissionScope): boolean => {
      if (!user) return false;
      if (user.role !== 'admin') return false;
      if (!adminPerms) return true;
      return adminPerms[scope] !== false;
    },
    [user, adminPerms],
  );

  return (
    <PermissionsContext.Provider
      value={{
        isAdmin,
        isVolunteer,
        can,
        loading,
        roleLabel,
        refresh: load,
      }}
    >
      {children}
    </PermissionsContext.Provider>
  );
}

export function usePermissions(): PermissionsContextType {
  return useContext(PermissionsContext);
}
