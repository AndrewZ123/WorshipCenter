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
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  church: null,
  loading: true,
  login: async () => false,
  signup: async () => false,
  join: async () => false,
  logout: () => {},
});

// Removed simple password store methods since Supabase Auth handles credentials.

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [church, setChurch] = useState<Church | null>(null);
  const [loading, setLoading] = useState(true);
  const pendingAuthId = React.useRef<string | null>(null);

  // Load Profile from Supabase
  const loadProfile = async (authUserId: string): Promise<'success' | 'not_found' | 'error' | 'aborted'> => {
    // If we're already loading this user, don't start another concurrent request
    if (pendingAuthId.current === authUserId) {
      console.log('[Auth] Profile load already in progress for:', authUserId);
      return 'aborted';
    }
    
    // If we already have this user profile, skip reload
    if (user?.id === authUserId && church) {
      console.log('[Auth] Profile already loaded for:', authUserId);
      return 'success';
    }
    
    pendingAuthId.current = authUserId;
    console.log('[Auth] Loading profile for:', authUserId);
    
    try {
      const { data: userData, error: userError } = await supabase
        .from('users')
        .select('*')
        .eq('id', authUserId)
        .maybeSingle();

      if (userError) {
        const isAbort = userError?.message?.includes('AbortError') || userError?.details?.includes('AbortError');
        if (isAbort) {
          console.warn('[Auth] Profile load aborted (lock conflict).');
          return 'aborted';
        }
        console.error('[Auth] Profile load error:', userError);
        return 'error';
      }

      if (!userData) {
        console.warn('[Auth] No user profile found for ID:', authUserId);
        return 'not_found';
      }
      
      console.log('[Auth] User profile loaded:', userData.email, userData.role);
      setUser(userData as User);

      const { data: churchData, error: churchError } = await supabase
        .from('churches')
        .select('*')
        .eq('id', (userData as User).church_id)
        .maybeSingle();
        
      if (churchError) {
        console.error('[Auth] Church load error:', churchError);
      }

      console.log('[Auth] Church profile loaded:', churchData?.name);
      setChurch(churchData ? (churchData as Church) : null);
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
    console.log('[Auth] Initializing AuthProvider...');
    let initialized = false;

    const handleAuthState = async (event: string, session: any) => {
      console.log('[Auth] Handling auth state:', event, session?.user?.email || 'none');

      if (session?.user) {
        const status = await loadProfile(session.user.id);
        
        if (status === 'aborted') {
          // If aborted by lock, wait 500ms and try again once.
          // Don't set loading=false yet.
          console.log('[Auth] Retrying profile load in 500ms...');
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
        console.log('[Auth] Initial session resolved, setting loading to false.');
      }
      setLoading(false);
    };

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
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

      // onAuthStateChange will fire and load the profile automatically.
      return true;
    } catch (err) {
      console.error('[Auth] Join exception:', err);
      return false;
    }
  }, []);

  const logout = useCallback(async () => {
    await supabase.auth.signOut();
    setUser(null);
    setChurch(null);
  }, []);

  return (
    <AuthContext.Provider value={{ user, church, loading, login, signup, join, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
