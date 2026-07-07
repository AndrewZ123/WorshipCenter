import { openDB, IDBPDatabase } from 'idb';

interface SyncQueueItem {
  id?: number;
  table: string;
  action: 'create' | 'update' | 'delete';
  recordId: string;
  payload: Record<string, unknown>;
  createdAt: number;
  retries: number;
  maxRetries: number;
}

let dbPromise: Promise<IDBPDatabase> | null = null;

function getDb(): Promise<IDBPDatabase> {
  if (!dbPromise) {
    dbPromise = openDB('worshipcenter-offline', 2, {
      upgrade(db) {
        if (!db.objectStoreNames.contains('syncQueue')) {
          const store = db.createObjectStore('syncQueue', { keyPath: 'id', autoIncrement: true });
          store.createIndex('by_table', 'table');
          store.createIndex('by_createdAt', 'createdAt');
        }
      },
    });
  }
  return dbPromise;
}

function getSupabaseClient() {
  return import('@/lib/supabase').then(m => m.supabase);
}

export const syncManager = {
  enqueue: async (table: string, action: 'create' | 'update' | 'delete', recordId: string, payload: Record<string, unknown>): Promise<void> => {
    try {
      const db = await getDb();
      await db.add('syncQueue', {
        table,
        action,
        recordId,
        payload,
        createdAt: Date.now(),
        retries: 0,
        maxRetries: 5,
      });
    } catch {
      // Queue may not be available
    }
  },

  processQueue: async (): Promise<{ succeeded: number; failed: number }> => {
    const supabase = await getSupabaseClient();
    let succeeded = 0;
    let failed = 0;

    try {
      const db = await getDb();
      const allItems = await db.getAll('syncQueue') as SyncQueueItem[];
      allItems.sort((a, b) => (a.createdAt || 0) - (b.createdAt || 0));

      for (const item of allItems) {
        try {
          let query;
          switch (item.action) {
            case 'create':
              query = supabase.from(item.table).insert(item.payload);
              break;
            case 'update':
              query = supabase.from(item.table).update(item.payload).eq('id', item.recordId);
              break;
            case 'delete':
              query = supabase.from(item.table).delete().eq('id', item.recordId);
              break;
          }
          let result;
          if (item.action === 'delete') {
            result = await query;
          } else {
            result = await query.select();
          }
          if (result?.error) throw result.error;
          await db.delete('syncQueue', item.id!);
          succeeded++;
        } catch {
          item.retries = (item.retries || 0) + 1;
          if (item.retries >= (item.maxRetries || 5)) {
            await db.delete('syncQueue', item.id!);
            failed++;
          } else {
            await db.put('syncQueue', item);
            failed++;
          }
        }
      }
    } catch {
      // Queue processing failed
    }

    return { succeeded, failed };
  },

  getQueueSize: async (): Promise<number> => {
    try {
      const db = await getDb();
      return await db.count('syncQueue');
    } catch {
      return 0;
    }
  },

  getQueueItems: async (): Promise<SyncQueueItem[]> => {
    try {
      const db = await getDb();
      const items = await db.getAll('syncQueue') as SyncQueueItem[];
      items.sort((a, b) => (a.createdAt || 0) - (b.createdAt || 0));
      return items;
    } catch {
      return [];
    }
  },

  clearQueue: async (): Promise<void> => {
    try {
      const db = await getDb();
      await db.clear('syncQueue');
    } catch {
      // ignore
    }
  },

  cancelItem: async (id: number): Promise<void> => {
    try {
      const db = await getDb();
      await db.delete('syncQueue', id);
    } catch {
      // ignore
    }
  },
};
