import { getCalendarDayIndex } from './formatDate';

export type ServiceStatusBucket =
  | 'completed'
  | 'past'
  | 'upcomingPlanned'
  | 'upcomingFinalized';

/** Status values StatusBadge understands for a service. */
export type ServiceBadgeStatus = 'draft' | 'finalized' | 'completed';

export interface StatusClassifiableService {
  status?: string | null;
  date: string | Date;
}

export interface ServiceStatusCounts {
  completed: number;
  past: number;
  upcomingPlanned: number;
  upcomingFinalized: number;
}

/**
 * Classify a service for reports and badges.
 *
 * Product rule: a service dated today or later is never “Completed”. Its real
 * status field only distinguishes Planned (`draft`, or a stray `completed`)
 * from Finalized. Past services are Completed only when their status says so.
 *
 * Dates are compared as calendar days so a `YYYY-MM-DD` string is not shifted
 * by the UTC offset.
 */
export function classifyServiceStatus(
  service: StatusClassifiableService,
  now: Date = new Date()
): ServiceStatusBucket {
  const serviceDay = getCalendarDayIndex(service.date);
  const today = getCalendarDayIndex(now);
  const isTodayOrFuture =
    serviceDay !== null && today !== null && serviceDay >= today;

  if (isTodayOrFuture) {
    return service.status === 'finalized'
      ? 'upcomingFinalized'
      : 'upcomingPlanned';
  }

  return service.status === 'completed' ? 'completed' : 'past';
}

/**
 * Single source of truth for service badges on the dashboard, services list,
 * and service detail. Derived from classifyServiceStatus so badges and reports
 * can never disagree.
 */
export function getServiceBadgeStatus(
  service: StatusClassifiableService,
  now: Date = new Date()
): ServiceBadgeStatus {
  switch (classifyServiceStatus(service, now)) {
    case 'completed':
      return 'completed';
    case 'upcomingFinalized':
      return 'finalized';
    default:
      return 'draft';
  }
}

export function countServiceStatuses(
  services: StatusClassifiableService[],
  now: Date = new Date()
): ServiceStatusCounts {
  const counts: ServiceStatusCounts = {
    completed: 0,
    past: 0,
    upcomingPlanned: 0,
    upcomingFinalized: 0,
  };

  for (const service of services) {
    counts[classifyServiceStatus(service, now)]++;
  }

  return counts;
}
