import { openDB, IDBPDatabase } from 'idb';

const DB_NAME = 'worshipcenter-offline';
const DB_VERSION = 2;

type StoreName = 'services' | 'serviceItems' | 'songs' | 'songFiles' | 'assignments' | 'teamMembers' | 'tasks' | 'chatMessages' | 'serviceChatMessages' | 'notifications' | 'debriefs' | 'rehearsalLogs' | 'blockoutDates' | 'preferences';

interface CacheEntry<T = unknown> {
  id: string;
  data: T;
  cachedAt: number;
  ttl: number;
}

const DEFAULT_TTL = 1000 * 60 * 60 * 24;

let dbPromise: Promise<IDBPDatabase> | null = null;

function getDb(): Promise<IDBPDatabase> {
  if (!dbPromise) {
    dbPromise = openDB(DB_NAME, DB_VERSION, {
      upgrade(db) {
        for (const store of ['services', 'serviceItems', 'songs', 'songFiles', 'assignments', 'teamMembers', 'tasks', 'chatMessages', 'serviceChatMessages', 'notifications', 'debriefs', 'rehearsalLogs', 'blockoutDates', 'preferences'] as StoreName[]) {
          if (!db.objectStoreNames.contains(store)) {
            const objectStore = db.createObjectStore(store, { keyPath: 'id' });
            objectStore.createIndex('by_churchId', 'data.church_id');
            objectStore.createIndex('by_serviceId', 'data.service_id');
            objectStore.createIndex('by_cachedAt', 'cachedAt');
          }
        }
        const syncStore = 'syncQueue';
        if (!db.objectStoreNames.contains(syncStore)) {
          const store = db.createObjectStore(syncStore, { keyPath: 'id', autoIncrement: true });
          store.createIndex('by_table', 'table');
          store.createIndex('by_createdAt', 'createdAt');
        }
        const metaStore = 'cacheMeta';
        if (!db.objectStoreNames.contains(metaStore)) {
          db.createObjectStore(metaStore, { keyPath: 'key' });
        }
      },
    });
  }
  return dbPromise;
}

function isExpired(entry: CacheEntry): boolean {
  return Date.now() - entry.cachedAt > entry.ttl;
}

export const offlineCache = {
  async set<T>(store: StoreName, id: string, data: T, ttl = DEFAULT_TTL): Promise<void> {
    try {
      const db = await getDb();
      await db.put(store, {
        id,
        data,
        cachedAt: Date.now(),
        ttl,
      } as CacheEntry<T>);
    } catch {
      // Cache may not be available (SSR, incognito)
    }
  },

  async get<T>(store: StoreName, id: string): Promise<T | null> {
    try {
      const db = await getDb();
      const entry = await db.get(store, id) as CacheEntry<T> | undefined;
      if (!entry) return null;
      if (isExpired(entry)) {
        await db.delete(store, id).catch(() => {});
        return null;
      }
      return entry.data;
    } catch {
      return null;
    }
  },

  async delete(store: StoreName, id: string): Promise<void> {
    try {
      const db = await getDb();
      await db.delete(store, id);
    } catch {
      // ignore
    }
  },

  async getAll<T>(store: StoreName): Promise<T[]> {
    try {
      const db = await getDb();
      const entries = await db.getAll(store) as CacheEntry<T>[];
      const valid = entries.filter(e => !isExpired(e));
      const expired = entries.filter(e => isExpired(e));
      if (expired.length > 0) {
        const tx = db.transaction(store, 'readwrite');
        await Promise.all(expired.map(e => tx.store.delete(e.id)));
        await tx.done;
      }
      return valid.map(e => e.data);
    } catch {
      return [];
    }
  },

  async getByField<T>(store: StoreName, field: string, value: unknown): Promise<T[]> {
    try {
      const db = await getDb();
      const tx = db.transaction(store, 'readonly');
      const storeObj = tx.objectStore(store);
      const indexName = `by_${field}`;
      const hasIndex = storeObj.indexNames.contains(indexName);
      await tx.done;

      if (!hasIndex) {
        const all = await offlineCache.getAll<Record<string, unknown>>(store);
        return all.filter(item => item[field] === value) as unknown as T[];
      }
      const entries = await db.getAllFromIndex(store, indexName, value as IDBValidKey) as CacheEntry<T>[];
      const valid = entries.filter(e => !isExpired(e));
      return valid.map(e => e.data);
    } catch {
      return [];
    }
  },

  async getUpcomingServices<T>(churchId: string, weeks = 4): Promise<T[]> {
    const all = await offlineCache.getAll<T>('services');
    const now = new Date();
    const cutoff = new Date(now.getTime() + weeks * 7 * 24 * 60 * 60 * 1000);
    return all.filter(s => {
      const svc = s as Record<string, unknown>;
      return svc.church_id === churchId && typeof svc.date === 'string' && svc.date >= now.toISOString().slice(0, 10) && svc.date <= cutoff.toISOString().slice(0, 10);
    }).sort((a, b) => {
      const sa = a as Record<string, unknown>;
      const sb = b as Record<string, unknown>;
      return (sa.date as string).localeCompare(sb.date as string);
    });
  },

  async clear(): Promise<void> {
    try {
      const db = await getDb();
      const stores = db.objectStoreNames;
      for (let i = 0; i < stores.length; i++) {
        const name = stores[i];
        if (name !== 'syncQueue' && name !== 'cacheMeta') {
          await db.clear(name);
        }
      }
    } catch {
      // ignore
    }
  },

  async clearExpired(): Promise<number> {
    let cleared = 0;
    try {
      const db = await getDb();
      const stores = db.objectStoreNames;
      for (let i = 0; i < stores.length; i++) {
        const name = stores[i];
        if (name === 'syncQueue' || name === 'cacheMeta') continue;
        const entries = await db.getAll(name) as CacheEntry[];
        const expired = entries.filter(e => isExpired(e));
        if (expired.length > 0) {
          const tx = db.transaction(name, 'readwrite');
          await Promise.all(expired.map(e => tx.store.delete(e.id)));
          await tx.done;
          cleared += expired.length;
        }
      }
    } catch {
      // ignore
    }
    return cleared;
  },

  async getSize(): Promise<{ stores: Record<string, number>; total: number }> {
    const result: Record<string, number> = {};
    let total = 0;
    try {
      const db = await getDb();
      const stores = db.objectStoreNames;
      for (let i = 0; i < stores.length; i++) {
        const name = stores[i];
        if (name === 'syncQueue' || name === 'cacheMeta') continue;
        const count = await db.count(name);
        result[name] = count;
        total += count;
      }
    } catch {
      // ignore
    }
    return { stores: result, total };
  },

  async cacheServiceWithRelated(service: Record<string, unknown>, _churchId: string): Promise<void> {
    const serviceId = service.id as string;
    await offlineCache.set('services', serviceId, service);
  },

  async cacheServices(services: Record<string, unknown>[], _churchId: string): Promise<void> {
    for (const svc of services) {
      await offlineCache.set('services', svc.id as string, svc);
    }
  },

  async cacheSongs(songs: Record<string, unknown>[], _churchId: string): Promise<void> {
    for (const song of songs) {
      await offlineCache.set('songs', song.id as string, song);
    }
  },

  async cacheAssignments(assignments: Record<string, unknown>[], _churchId: string): Promise<void> {
    for (const a of assignments) {
      await offlineCache.set('assignments', a.id as string, a);
    }
  },

  async cacheTeamMembers(members: Record<string, unknown>[], _churchId: string): Promise<void> {
    for (const m of members) {
      await offlineCache.set('teamMembers', m.id as string, m);
    }
  },

  async cacheServiceItems(items: Record<string, unknown>[], _serviceId: string): Promise<void> {
    for (const item of items) {
      await offlineCache.set('serviceItems', item.id as string, item);
    }
  },
};
