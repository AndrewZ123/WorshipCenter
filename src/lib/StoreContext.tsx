'use client';

import React, { createContext, useContext } from 'react';
import { db as realDb } from './store';

// Define the store interface type based on the real db
export type StoreType = typeof realDb;

const StoreContext = createContext<StoreType | null>(null);

export function useStore() {
  const store = useContext(StoreContext);
  // If no provider, fall back to real db (for backwards compatibility)
  return store || realDb;
}

interface StoreProviderProps {
  children: React.ReactNode;
  store: StoreType;
}

export function StoreProvider({ children, store }: StoreProviderProps) {
  return (
    <StoreContext.Provider value={store}>
      {children}
    </StoreContext.Provider>
  );
}