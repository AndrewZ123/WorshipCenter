import { vi, type Mock } from 'vitest';

export type FakeQueryResult = { data: unknown; error: unknown };
type ResultSource = FakeQueryResult | (() => FakeQueryResult);

export interface FakeOperation {
  table: string;
  method: string;
  args: unknown[];
}

/**
 * Minimal in-memory stand-in for a Supabase client.
 *
 * Test files install it by mocking `@supabase/supabase-js`'s `createClient`,
 * which is what both `@/lib/supabase` and `@/lib/auth-middleware` use. No
 * network calls are made; query results are configured per table.
 *
 * The fake records chained query operations in `operations` so tests can assert
 * that (for example) an update was filtered by the caller's church_id.
 */
export interface FakeSupabaseClient {
  auth: {
    getUser: Mock;
    resetPasswordForEmail: Mock;
    admin: { deleteUser: Mock };
  };
  from: Mock;
  rpc: Mock;
  results: Record<string, ResultSource>;
  operations: FakeOperation[];
  setTableResult(table: string, result: ResultSource): void;
  operationsFor(table: string): FakeOperation[];
  reset(): void;
}

const CHAIN_METHODS = [
  'select',
  'eq',
  'neq',
  'gt',
  'gte',
  'lt',
  'lte',
  'in',
  'or',
  'ilike',
  'textSearch',
  'overlaps',
  'order',
  'limit',
  'range',
  'is',
  'not',
  'contains',
  'match',
  'filter',
  'insert',
  'update',
  'delete',
  'upsert',
] as const;

export function createFakeSupabaseClient(): FakeSupabaseClient {
  const results: Record<string, ResultSource> = {};
  const operations: FakeOperation[] = [];

  const auth = {
    getUser: vi.fn(async () => ({
      data: { user: null },
      error: { message: 'invalid token' },
    })),
    resetPasswordForEmail: vi.fn(async () => ({ data: {}, error: null })),
    admin: {
      deleteUser: vi.fn(async () => ({ data: {}, error: null })),
    },
  };

  const from = vi.fn((table: string) => {
    const resolve = (): FakeQueryResult => {
      const configured = results[table];
      if (!configured) {
        return { data: null, error: null };
      }
      return typeof configured === 'function' ? configured() : configured;
    };

    const builder: Record<string, unknown> = {};

    for (const method of CHAIN_METHODS) {
      builder[method] = (...args: unknown[]) => {
        operations.push({ table, method, args });
        return builder;
      };
    }

    builder.single = () => {
      operations.push({ table, method: 'single', args: [] });
      return Promise.resolve(resolve());
    };
    builder.maybeSingle = () => {
      operations.push({ table, method: 'maybeSingle', args: [] });
      return Promise.resolve(resolve());
    };
    builder.then = <TResult1 = FakeQueryResult, TResult2 = never>(
      onfulfilled?: ((value: FakeQueryResult) => TResult1 | PromiseLike<TResult1>) | null,
      onrejected?: ((reason: unknown) => TResult2 | PromiseLike<TResult2>) | null
    ) => Promise.resolve(resolve()).then(onfulfilled, onrejected);

    return builder;
  });

  return {
    auth,
    from,
    rpc: vi.fn(async () => ({ data: null, error: null })),
    results,
    operations,
    setTableResult(table, result) {
      results[table] = result;
    },
    operationsFor(table) {
      return operations.filter((operation) => operation.table === table);
    },
    reset() {
      for (const key of Object.keys(results)) {
        delete results[key];
      }
      operations.length = 0;
      auth.getUser.mockReset();
      auth.resetPasswordForEmail.mockReset();
      auth.admin.deleteUser.mockReset();
      from.mockClear();
    },
  };
}
