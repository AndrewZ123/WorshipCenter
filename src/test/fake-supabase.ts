import { vi, type Mock } from 'vitest';

export type FakeQueryResult = { data: unknown; error: unknown };
type ResultSource = FakeQueryResult | (() => FakeQueryResult);

/**
 * Minimal in-memory stand-in for a Supabase client.
 *
 * Test files install it by mocking `@supabase/supabase-js`'s `createClient`,
 * which is what both `@/lib/supabase` and `@/lib/auth-middleware` use. No
 * network calls are made; query results are configured per table.
 */
export interface FakeSupabaseClient {
  auth: { getUser: Mock };
  from: Mock;
  results: Record<string, ResultSource>;
  setTableResult(table: string, result: ResultSource): void;
  reset(): void;
}

export function createFakeSupabaseClient(): FakeSupabaseClient {
  const results: Record<string, ResultSource> = {};

  const auth = {
    getUser: vi.fn(async () => ({
      data: { user: null },
      error: { message: 'invalid token' },
    })),
  };

  const from = vi.fn((table: string) => {
    const resolve = (): FakeQueryResult => {
      const configured = results[table];
      if (!configured) {
        return { data: null, error: null };
      }
      return typeof configured === 'function' ? configured() : configured;
    };

    const builder = {
      select: () => builder,
      eq: () => builder,
      in: () => builder,
      insert: () => builder,
      update: () => builder,
      delete: () => builder,
      single: () => Promise.resolve(resolve()),
      maybeSingle: () => Promise.resolve(resolve()),
      then: <TResult1 = FakeQueryResult, TResult2 = never>(
        onfulfilled?: ((value: FakeQueryResult) => TResult1 | PromiseLike<TResult1>) | null,
        onrejected?: ((reason: unknown) => TResult2 | PromiseLike<TResult2>) | null
      ) => Promise.resolve(resolve()).then(onfulfilled, onrejected),
    };

    return builder;
  });

  return {
    auth,
    from,
    results,
    setTableResult(table, result) {
      results[table] = result;
    },
    reset() {
      for (const key of Object.keys(results)) {
        delete results[key];
      }
      auth.getUser.mockReset();
      from.mockClear();
    },
  };
}
