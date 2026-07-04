'use client';

import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import type { User, Church } from '@/lib/types';
import { supabase } from '@/lib/supabase';
import { apiBaseUrl, isCapacitorNative, getRedirectUrl } from '@/lib/api-base';

interface AuthContextType {
  user: User | null;
  church: Church | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<boolean>;
  signup: (churchName: string, userName: string, email: string, password: string) => Promise<boolean>;
  join: (email: string, churchId: string, password: string) => Promise<boolean>;
  logout: () => void;
  resetPassword: (email: string) => Promise<boolean>;
  updatePassword: (password: string) => Promise<boolean>;
  deleteAccount: () => Promise<{ success: boolean; error?: string }>;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  church: null,
  loading: true,
  login: async () => false,
  signup: async () => false,
  join: async () => false,
  logout: () => {},
  resetPassword: async () => false,
  updatePassword: async () => false,
  deleteAccount: async () => ({ success: false, error: 'Not implemented' }),
});

// Removed simple password store methods since Supabase Auth handles credentials.

export function AuthProvider({ children }: { children: React.ReactNode }) {
  // Restore user from localStorage synchronously — eliminates spinner flash
  // on full page refresh. The onAuthStateChange subscription still validates &
  // refreshes the session in the background.
  const [user, setUser] = useState<User | null>(() => {
    if (typeof window === 'undefined') return null;
    try {
      // Find our cached user profile by scanning for wc_user_ keys
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key?.startsWith('wc_user_')) {
          const raw = localStorage.getItem(key);
          if (raw) return JSON.parse(raw) as User;
        }
      }
      return null;
    } catch { return null; }
  });
  const [church, setChurch] = useState<Church | null>(null);
  const [loading, setLoading] = useState(() => !user);
  const pendingAuthId = React.useRef<string | null>(null);

  // Refs that mirror state — readable inside the onAuthStateChange closure
  // without causing re-subscriptions. This prevents the stale-closure bug
  // where TOKEN_REFRESHED events would bypass the "already loaded" guard
  // and re-fetch the profile (creating new object references → cascading
  // re-renders every time the tab regains focus).
  const userIdRef = React.useRef<string | null>(null);
  const churchRef = React.useRef<Church | null>(null);

  // Keep refs in sync with state so the onAuthStateChange closure (subscribed
  // once on mount) always reads current values instead of stale captures.
  useEffect(() => {
    userIdRef.current = user?.id ?? null;
  }, [user]);
  useEffect(() => {
    churchRef.current = church;
  }, [church]);

  // Shallow JSON equality check to avoid spurious state updates
  const isSameData = (a: unknown, b: unknown) => {
    if (a === b) return true;
    try {
      return JSON.stringify(a) === JSON.stringify(b);
    } catch {
      return false;
    }
  };

  // Load Profile from Supabase
  const loadProfile = useCallback(async (authUserId: string, useCache = true): Promise<'success' | 'not_found' | 'error' | 'aborted'> => {
    // If we're already loading this user, don't start another concurrent request
    if (pendingAuthId.current === authUserId) {
      return 'aborted';
    }
    
    // If we already have this user profile loaded, skip reload.
    // Uses refs (not state) so this guard works even from the stale
    // onAuthStateChange closure.
    if (userIdRef.current === authUserId && churchRef.current) {
      return 'success';
    }

    // Try to load from cache first
    if (useCache) {
      try {
        const cachedUser = localStorage.getItem(`wc_user_${authUserId}`);
        const cachedChurch = localStorage.getItem(`wc_church_${authUserId}`);
        if (cachedUser && cachedChurch) {
          const parsedUser = JSON.parse(cachedUser);
          const parsedChurch = JSON.parse(cachedChurch);
          // Only update state if data actually changed
          setUser(prev => isSameData(prev, parsedUser) ? prev : parsedUser);
          setChurch(prev => isSameData(prev, parsedChurch) ? prev : parsedChurch);
          
          // Load fresh data in background without blocking UI
          loadProfile(authUserId, false).catch(err => {
            // Silent background refresh failure
          });
          
          return 'success';
        }
      } catch (err) {
        // Silent cache failure
      }
    }
    
    pendingAuthId.current = authUserId;
    
    try {
      const { data: userData, error: userError } = await supabase
        .from('users')
        .select('*')
        .eq('id', authUserId)
        .maybeSingle();

      if (userError) {
        const isAbort = userError?.message?.includes('AbortError') || userError?.details?.includes('AbortError');
        if (isAbort) {
          return 'aborted';
        }
        return 'error';
      }

      if (!userData) {
        return 'not_found';
      }

      let { data: teamMember } = await supabase
        .from('team_members')
        .select('id')
        .eq('user_id', authUserId)
        .maybeSingle();

      if (!teamMember && userData.role === 'admin') {
        const { data: newMember } = await supabase
          .from('team_members')
          .insert({
            church_id: userData.church_id,
            name: userData.name,
            email: userData.email || '',
            phone: '',
            roles: ['Worship Leader'],
            user_id: authUserId,
          })
          .select('id')
          .maybeSingle();
        teamMember = newMember;
      }

      if (teamMember) {
        (userData as any).team_member_id = teamMember.id;
      }
      
      setUser(prev => isSameData(prev, userData) ? prev : userData as User);

      const { data: churchData, error: churchError } = await supabase
        .from('churches')
        .select('*')
        .eq('id', (userData as User).church_id)
        .maybeSingle();
        
      if (churchError) {
        // Silent church load error
      }
      const churchVal = churchData ? (churchData as Church) : null;
      setChurch(prev => isSameData(prev, churchVal) ? prev : churchVal);
      
      // Cache the data for faster loads
      try {
        localStorage.setItem(`wc_user_${authUserId}`, JSON.stringify(userData));
        if (churchData) {
          localStorage.setItem(`wc_church_${authUserId}`, JSON.stringify(churchData));
        }
      } catch (err) {
        console.warn('[Auth] Failed to cache profile data:', err);
      }
      
      return 'success';
    } catch (err) {
      console.error('[Auth] loadProfile exception:', err);
      return 'error';
    } finally {
      pendingAuthId.current = null;
    }
  }, []);

  // Restore session and subscribe to auth changes
  useEffect(() => {
    let initialized = false;

    const handleAuthState = async (event: string, session: any) => {
      // Skip TOKEN_REFRESHED entirely. Supabase fires this when the tab
      // regains focus or on an auto-refresh timer. The session is still
      // valid (same user id) and we've already loaded the profile, so
      // re-fetching only causes a cascading re-render "flash" — the exact
      // symptom reported. SIGNED_IN / SIGNED_OUT / USER_UPDATED still work.
      if (event === 'TOKEN_REFRESHED' && userIdRef.current) {
        setLoading(false);
        return;
      }

      if (session?.user) {
        const status = await loadProfile(session.user.id);
        
        if (status === 'aborted') {
          // If aborted by lock, wait 500ms and try again once.
          // Don't set loading=false yet.
          setTimeout(() => handleAuthState('RETRY', session), 500);
          return;
        }

        if (status === 'not_found') {
          setUser(null);
          setChurch(null);
        }
      } else {
        setUser(null);
        setChurch(null);
      }

      if (!initialized) {
        initialized = true;
      }
      setLoading(false);
    };

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      // Only log in development
      if (process.env.NODE_ENV === 'development' && session?.user?.email) {
        console.log(`[Auth] Handling auth state: ${event}`, session.user.email);
      }
      handleAuthState(event, session);
    });

    return () => {
      subscription.unsubscribe();
    };
  }, []);


  const login = useCallback(async (email: string, password: string): Promise<boolean> => {
    try {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) {
        console.error('[Auth] Login error:', error.message);
        return false;
      }
      // onAuthStateChange will automatically fire SIGNED_IN and load the profile.
      return true;
    } catch (err) {
      console.error('[Auth] Login exception:', err);
      return false;
    }
  }, []);

  const signup = useCallback(async (
    churchName: string, userName: string, email: string, password: string
  ): Promise<boolean> => {
    if (!email || !password || password.length < 6) return false;
    
    try {
      // 1. Create Supabase Auth User
      const { data: authData, error: authError } = await supabase.auth.signUp({ email, password });
      if (authError || !authData.user) {
        console.error('[Auth] Signup auth error:', authError?.message);
        return false;
      }

      // 2. Call server-side API to create church, subscription, user profile, and team member
      //    (bypasses the buggy signup_church RPC function that causes duplicate key errors)
      const signupResponse = await fetch(`${apiBaseUrl()}/api/auth/signup`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          churchName,
          userName,
          email,
          password,
          authUserId: authData.user.id,
        }),
      });

      const signupResult = await signupResponse.json();

      if (!signupResponse.ok || !signupResult.success) {
        console.error('[Auth] Signup API error:', signupResult.error || 'Unknown error');
        return false;
      }

      console.log('[Auth] Signup successful, church created:', signupResult.church_id);

      // Send welcome email
      try {
        const welcomeEmailResponse = await fetch(`${apiBaseUrl()}/api/notifications/send-welcome`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            userId: authData.user.id,
            churchId: signupResult.church_id,
          }),
        });
        
        if (welcomeEmailResponse.ok) {
          console.log('[Auth] Welcome email sent successfully');
        } else {
          console.warn('[Auth] Failed to send welcome email, but signup succeeded');
        }
      } catch (emailError) {
        // Don't fail signup if email fails
        console.warn('[Auth] Welcome email error:', emailError);
      }

      // onAuthStateChange will fire and load the profile automatically.
      return true;
    } catch (err) {
      console.error('[Auth] Signup exception:', err);
      return false;
    }
  }, []);

  const join = useCallback(async (
    email: string, churchId: string, password: string
  ): Promise<boolean> => {
    if (!email || !churchId || !password || password.length < 6) return false;

    try {
      // Check if team member profile exists in Supabase
      const { data: teamMembers } = await supabase
        .from('team_members')
        .select('*')
        .eq('church_id', churchId)
        .ilike('email', email);
        
      if (!teamMembers || teamMembers.length === 0) {
        console.error('[Auth] Join: No team member invitation found for', email);
        return false;
      }

      // 1. Create Supabase Auth User
      const { data: authData, error: authError } = await supabase.auth.signUp({ email, password });
      if (authError || !authData.user) {
        console.error('[Auth] Join auth error:', authError?.message);
        return false;
      }

      // 2. Create User Profile mapping to team member's pre-existing church
      const memberProfile = teamMembers[0];
      const { error: profileError } = await supabase
        .from('users')
        .insert({ id: authData.user.id, church_id: churchId, name: memberProfile.name, email: memberProfile.email, role: 'team' });
      if (profileError) {
        console.error('[Auth] Join profile create error:', profileError.message);
        return false;
      }

      // Send welcome email to team member
      try {
        const welcomeEmailResponse = await fetch(`${apiBaseUrl()}/api/notifications/send-welcome`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            userId: authData.user.id,
            churchId: churchId,
          }),
        });
        
        if (welcomeEmailResponse.ok) {
          console.log('[Auth] Welcome email sent to team member successfully');
        } else {
          console.warn('[Auth] Failed to send welcome email to team member, but join succeeded');
        }
      } catch (emailError) {
        // Don't fail join if email fails
        console.warn('[Auth] Welcome email error:', emailError);
      }

      // onAuthStateChange will fire and load the profile automatically.
      return true;
    } catch (err) {
      console.error('[Auth] Join exception:', err);
      return false;
    }
  }, []);

  const logout = useCallback(async () => {
    await supabase.auth.signOut();
    
    // Clear cached data
    if (user?.id) {
      try {
        localStorage.removeItem(`wc_user_${user.id}`);
        localStorage.removeItem(`wc_church_${user.id}`);
        // Clear subscription cache
        if (user.church_id) {
          localStorage.removeItem(`wc_subscription_${user.church_id}`);
        }
      } catch (err) {
        console.warn('[Auth] Failed to clear cache on logout:', err);
      }
    }
    
    setUser(null);
    setChurch(null);
  }, [user]);

  const resetPassword = useCallback(async (email: string): Promise<boolean> => {
    try {
      // On mobile, redirect back to the native app via deep link
      const redirectTo = getRedirectUrl('/new-password');
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo,
      });
      if (error) {
        console.error('[Auth] Reset password error:', error.message);
        return false;
      }
      return true;
    } catch (err) {
      console.error('[Auth] Reset password exception:', err);
      return false;
    }
  }, []);

  const updatePassword = useCallback(async (password: string): Promise<boolean> => {
    try {
      const { error } = await supabase.auth.updateUser({ password });
      if (error) {
        console.error('[Auth] Update password error:', error.message);
        return false;
      }
      return true;
    } catch (err) {
      console.error('[Auth] Update password exception:', err);
      return false;
    }
  }, []);

  const deleteAccount = useCallback(async (): Promise<{ success: boolean; error?: string }> => {
    try {
      // Get current session token for auth
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) {
        return { success: false, error: 'Not authenticated' };
      }

      const response = await fetch(`${apiBaseUrl()}/api/auth/delete-account`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`,
        },
      });

      const result = await response.json();

      if (!response.ok || !result.success) {
        return { success: false, error: result.error || 'Failed to delete account' };
      }

      // Clear cached data
      if (user?.id) {
        try {
          localStorage.removeItem(`wc_user_${user.id}`);
          localStorage.removeItem(`wc_church_${user.id}`);
          if (user.church_id) {
            localStorage.removeItem(`wc_subscription_${user.church_id}`);
          }
        } catch (err) {
          console.warn('[Auth] Failed to clear cache:', err);
        }
      }

      setUser(null);
      setChurch(null);

      return { success: true };
    } catch (err) {
      console.error('[Auth] Delete account exception:', err);
      return { success: false, error: 'Network error. Please try again.' };
    }
  }, [user]);

  return (
    <AuthContext.Provider value={{ user, church, loading, login, signup, join, logout, resetPassword, updatePassword, deleteAccount }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}