import { offlineCache } from './cache';
import { syncManager } from './sync';
import type {
  Service, ServiceItem, Song, ServiceAssignment, TeamMember,
} from '@/lib/types';

function isNetworkError(err: unknown): boolean {
  if (err instanceof TypeError && err.message === 'Failed to fetch') return true;
  if (err && typeof err === 'object' && 'message' in err) {
    const msg = String((err as { message: string }).message).toLowerCase();
    return msg.includes('network') || msg.includes('fetch') || msg.includes('abort') || msg.includes('timeout');
  }
  return false;
}

function isOnline(): boolean {
  return typeof navigator !== 'undefined' ? navigator.onLine : true;
}

export const cachedStore = {
  services: {
    async getByChurch(churchId: string): Promise<Service[]> {
      try {
        const data = await import('@/lib/store').then(m => m.db.services.getByChurch(churchId));
        if (data) offlineCache.cacheServices(data as unknown as Record<string, unknown>[], churchId);
        return data;
      } catch (err) {
        if (isNetworkError(err) || !isOnline()) {
          const cached = await offlineCache.getByField<Service>('services', 'church_id', churchId);
          if (cached.length > 0) return cached;
        }
        throw err;
      }
    },

    async getById(id: string, churchId: string): Promise<Service | null> {
      try {
        const data = await import('@/lib/store').then(m => m.db.services.getById(id, churchId));
        if (data) offlineCache.cacheServiceWithRelated(data as unknown as Record<string, unknown>, churchId);
        return data;
      } catch (err) {
        if (isNetworkError(err) || !isOnline()) {
          const cached = await offlineCache.get<Service>('services', id);
          if (cached) return cached;
        }
        throw err;
      }
    },
  },

  serviceItems: {
    async getByService(serviceId: string): Promise<ServiceItem[]> {
      try {
        const data = await import('@/lib/store').then(m => m.db.serviceItems.getByService(serviceId));
        if (data) offlineCache.cacheServiceItems(data as unknown as Record<string, unknown>[], serviceId);
        return data;
      } catch (err) {
        if (isNetworkError(err) || !isOnline()) {
          const cached = await offlineCache.getByField<ServiceItem>('serviceItems', 'service_id', serviceId);
          if (cached.length > 0) return cached;
        }
        throw err;
      }
    },
  },

  songs: {
    async getByChurch(churchId: string): Promise<Song[]> {
      try {
        const data = await import('@/lib/store').then(m => m.db.songs.getByChurch(churchId));
        if (data) offlineCache.cacheSongs(data as unknown as Record<string, unknown>[], churchId);
        return data;
      } catch (err) {
        if (isNetworkError(err) || !isOnline()) {
          const cached = await offlineCache.getByField<Song>('songs', 'church_id', churchId);
          if (cached.length > 0) return cached;
        }
        throw err;
      }
    },

    async getById(id: string, churchId: string): Promise<Song | null> {
      try {
        const data = await import('@/lib/store').then(m => m.db.songs.getById(id, churchId));
        if (data) offlineCache.set('songs', id, data);
        return data;
      } catch (err) {
        if (isNetworkError(err) || !isOnline()) {
          const cached = await offlineCache.get<Song>('songs', id);
          if (cached) return cached;
        }
        throw err;
      }
    },
  },

  assignments: {
    async getByService(serviceId: string, churchId: string): Promise<ServiceAssignment[]> {
      try {
        const data = await import('@/lib/store').then(m => m.db.assignments.getByService(serviceId, churchId));
        if (data) offlineCache.cacheAssignments(data as unknown as Record<string, unknown>[], churchId);
        return data;
      } catch (err) {
        if (isNetworkError(err) || !isOnline()) {
          const cached = await offlineCache.getByField<ServiceAssignment>('assignments', 'service_id', serviceId);
          if (cached.length > 0) return cached;
        }
        throw err;
      }
    },
  },

  teamMembers: {
    async getByChurch(churchId: string): Promise<TeamMember[]> {
      try {
        const data = await import('@/lib/store').then(m => m.db.teamMembers.getByChurch(churchId));
        if (data) offlineCache.cacheTeamMembers(data as unknown as Record<string, unknown>[], churchId);
        return data;
      } catch (err) {
        if (isNetworkError(err) || !isOnline()) {
          const cached = await offlineCache.getByField<TeamMember>('teamMembers', 'church_id', churchId);
          if (cached.length > 0) return cached;
        }
        throw err;
      }
    },

    async getById(id: string, churchId: string): Promise<TeamMember | null> {
      try {
        const data = await import('@/lib/store').then(m => m.db.teamMembers.getById(id, churchId));
        if (data) offlineCache.set('teamMembers', id, data);
        return data;
      } catch (err) {
        if (isNetworkError(err) || !isOnline()) {
          const cached = await offlineCache.get<TeamMember>('teamMembers', id);
          if (cached) return cached;
        }
        throw err;
      }
    },
  },

  async getUpcomingCachedServices(churchId: string): Promise<Service[]> {
    return offlineCache.getUpcomingServices<Service>(churchId);
  },
};

export async function withOfflineSync<T>(
  table: string,
  action: 'create' | 'update' | 'delete',
  recordId: string,
  payload: Record<string, unknown>,
  onlineFn: () => Promise<T>
): Promise<T> {
  if (isOnline()) {
    try {
      return await onlineFn();
    } catch (err) {
      if (isNetworkError(err)) {
        await syncManager.enqueue(table, action, recordId, payload);
      }
      throw err;
    }
  } else {
    await syncManager.enqueue(table, action, recordId, payload);
    // Return a resolved promise with null for optimistic behavior
    return null as unknown as T;
  }
}
