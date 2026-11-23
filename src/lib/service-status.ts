export type ServiceStatusBucket =
  | 'completed'
  | 'past'
  | 'upcomingPlanned'
  | 'upcomingFinalized';

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
 * Classify a service for the reports status breakdown.
 *
 * - `completed` is completed regardless of date (a completed service can still
 *   have a future date if it was marked done early).
 * - Future `draft` services are Planned (upcoming).
 * - Future `finalized` services are Finalized (upcoming).
 * - Everything else dated in the past is treated as a past service.
 */
export function classifyServiceStatus(
  service: StatusClassifiableService,
  now: Date = new Date()
): ServiceStatusBucket {
  if (service.status === 'completed') return 'completed';

  const date =
    service.date instanceof Date ? service.date : new Date(service.date);
  const isUpcoming = date.getTime() >= now.getTime();

  if (!isUpcoming) return 'past';
  return service.status === 'finalized' ? 'upcomingFinalized' : 'upcomingPlanned';
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
