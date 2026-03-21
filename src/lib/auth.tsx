'use client';

import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import type { User, Church } from '@/lib/types';
import { supabase } from '@/lib/supabase';

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
});

// Removed simple password store methods since Supabase Auth handles credentials.

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [church, setChurch] = useState<Church | null>(null);
  const [loading, setLoading] = useState(true);
  const pendingAuthId = React.useRef<string | null>(null);

  // Load Profile from Supabase
  const loadProfile = async (authUserId: string, useCache = true): Promise<'success' | 'not_found' | 'error' | 'aborted'> => {
    // If we're already loading this user, don't start another concurrent request
    if (pendingAuthId.current === authUserId) {
      return 'aborted';
    }
    
    // If we already have this user profile, skip reload
    if (user?.id === authUserId && church) {
      return 'success';
    }

    // Try to load from cache first
    if (useCache) {
      try {
        const cachedUser = localStorage.getItem(`wc_user_${authUserId}`);
        const cachedChurch = localStorage.getItem(`wc_church_${authUserId}`);
        if (cachedUser && cachedChurch) {
          setUser(JSON.parse(cachedUser));
          setChurch(JSON.parse(cachedChurch));
          
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
      
      setUser(userData as User);

      const { data: churchData, error: churchError } = await supabase
        .from('churches')
        .select('*')
        .eq('id', (userData as User).church_id)
        .maybeSingle();
        
      if (churchError) {
        // Silent church load error
      }
      setChurch(churchData ? (churchData as Church) : null);
      
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
  };

  // Restore session and subscribe to auth changes
  useEffect(() => {
    let initialized = false;

    const handleAuthState = async (event: string, session: any) => {
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

      // 2. Use SECURITY DEFINER function to create church + user profile (bypasses RLS)
      const { data: signupResult, error: signupError } = await supabase.rpc('signup_church', {
        p_church_name: churchName,
        p_user_name: userName,
        p_user_email: email,
        p_auth_user_id: authData.user.id
      });

      if (signupError) {
        console.error('[Auth] Signup RPC error:', signupError.message);
        return false;
      }

      if (!signupResult?.success) {
        console.error('[Auth] Signup function error:', signupResult?.error || 'Unknown error');
        return false;
      }

      console.log('[Auth] Signup successful, church created:', signupResult.church_id);

      // Note: Subscription is auto-created by database trigger (see supabase/migrations/002_add_subscriptions.sql)
      // This creates a 14-day trial automatically when a church is created.

      // Send welcome email
      try {
        const appUrl = process.env.NEXT_PUBLIC_APP_URL || window.location.origin;
        const welcomeEmailResponse = await fetch(`${appUrl}/api/notifications/send-welcome`, {
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
        const appUrl = process.env.NEXT_PUBLIC_APP_URL || window.location.origin;
        const welcomeEmailResponse = await fetch(`${appUrl}/api/notifications/send-welcome`, {
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
      const appUrl = process.env.NEXT_PUBLIC_APP_URL || window.location.origin;
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${appUrl}/new-password`,
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

  return (
    <AuthContext.Provider value={{ user, church, loading, login, signup, join, logout, resetPassword, updatePassword }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}