import type { ComponentType } from 'react';

export interface TourStep {
  id: string;
  title: string;
  description: string;
  targetSelector?: string;
  icon: ComponentType<{ size?: number }>;
}
