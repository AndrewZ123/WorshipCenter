import type { ComponentType } from 'react';

export type TourRole = 'admin' | 'leader' | 'volunteer';

export interface TourStep {
  id: string;
  title: string;
  description: string;
  targetSelector?: string;
  icon: ComponentType<{ size?: number }>;
  /** Auto-open the mobile drawer before showing this step */
  openDrawer?: boolean;
  /** Auto-close the mobile drawer before showing this step */
  closeDrawer?: boolean;
  /** Which roles should see this step. Omit = all roles */
  roles?: TourRole[];
}
