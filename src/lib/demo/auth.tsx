'use client';

import React, { createContext, useContext } from 'react';
import type { User, Church } from '@/lib/types';
import { useDemo } from './context';

// Re-export the same interface as the real AuthProvider
interface AuthContextType {
  user: User | null;
  church: Church | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<boolean>;
  signup: (churchName: string, userName: string, email: string, password: string) => Promise<boolean>;
  join: (email: string, churchId: string, password: string) => Promise<boolean>;
  logout: () => void;
}

const DemoAuthContext = createContext<AuthContextType>({
  user: null,
  church: null,
  loading: false,
  login: async () => false,
  signup: async () => false,
  join: async () => false,
  logout: () => {},
});

export function DemoAuthProvider({ children }: { children: React.ReactNode }) {
  const { user, church, loading } = useDemo();
  
  // Demo auth doesn't actually log in/signup - it's always logged in
  const login = async () => false;
  const signup = async () => false;
  const join = async () => false;
  const logout = () => {};
  
  return (
    <DemoAuthContext.Provider value={{ user, church, loading, login, signup, join, logout }}>
      {children}
    </DemoAuthContext.Provider>
  );
}

// Export useAuth with same name so components can use it
export function useAuth() {
  return useContext(DemoAuthContext);
}