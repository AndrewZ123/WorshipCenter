'use client';

import React, { createContext, useContext, useState, useCallback } from 'react';
import type { TourStep } from './types';

interface TourContextValue {
  isActive: boolean;
  currentStep: number;
  steps: TourStep[];
  start: (steps: TourStep[]) => void;
  next: () => void;
  prev: () => void;
  end: () => void;
  goTo: (index: number) => void;
  /** Programmatic drawer open (mobile), registered by AppShell/DemoShell */
  openDrawer: (() => void) | null;
  closeDrawer: (() => void) | null;
  setDrawerControls: (open: () => void, close: () => void) => void;
}

const TourContext = createContext<TourContextValue | null>(null);

export function TourProvider({ children }: { children: React.ReactNode }) {
  const [isActive, setIsActive] = useState(false);
  const [currentStep, setCurrentStep] = useState(0);
  const [steps, setSteps] = useState<TourStep[]>([]);
  const [openDrawerFn, setOpenDrawerFn] = useState<(() => void) | null>(null);
  const [closeDrawerFn, setCloseDrawerFn] = useState<(() => void) | null>(null);

  const start = useCallback((newSteps: TourStep[]) => {
    setSteps(newSteps);
    setCurrentStep(0);
    setIsActive(true);
  }, []);

  const next = useCallback(() => {
    setCurrentStep(prev => Math.min(prev + 1, steps.length - 1));
  }, [steps.length]);

  const prev = useCallback(() => {
    setCurrentStep(prev => Math.max(prev - 1, 0));
  }, []);

  const end = useCallback(() => {
    setIsActive(false);
    setSteps([]);
    setCurrentStep(0);
  }, []);

  const goTo = useCallback((index: number) => {
    setCurrentStep(index);
  }, []);

  const setDrawerControls = useCallback((open: () => void, close: () => void) => {
    setOpenDrawerFn(() => open);
    setCloseDrawerFn(() => close);
  }, []);

  return (
    <TourContext.Provider
      value={{
        isActive, currentStep, steps, start, next, prev, end, goTo,
        openDrawer: openDrawerFn,
        closeDrawer: closeDrawerFn,
        setDrawerControls,
      }}
    >
      {children}
    </TourContext.Provider>
  );
}

export function useTour() {
  const context = useContext(TourContext);
  if (!context) {
    throw new Error('useTour must be used within a TourProvider');
  }
  return context;
}
