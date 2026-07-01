import { createClient, PostgrestError, SupabaseClient } from '@supabase/supabase-js';

// Lazy initialization to avoid build-time errors when env vars aren't set
let supabaseInstance: SupabaseClient | null = null;

const getSupabaseClient = (): SupabaseClient => {
  if (!supabaseInstance) {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    
    if (!supabaseUrl || !supabaseAnonKey) {
      // Return a dummy client for build time
      return createClient('https://placeholder.supabase.co', 'placeholder-key');
    }
    
    supabaseInstance = createClient(supabaseUrl, supabaseAnonKey);
  }
  return supabaseInstance;
};

// Export a proxy that lazily initializes client
export const supabase = new Proxy({} as SupabaseClient, {
  get(_, prop) {
    return getSupabaseClient()[prop as keyof SupabaseClient];
  }
});

// Admin client with service role key (bypasses RLS)
let supabaseAdminInstance: SupabaseClient | null = null;

const getSupabaseAdminClient = (): SupabaseClient => {
  if (!supabaseAdminInstance) {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !supabaseServiceRoleKey) {
      // At build time env vars are intentionally absent; return a dummy client
      // so `next build` doesn't crash. At RUNTIME, however, a missing service
      // role key is a critical misconfiguration: every admin DB write (billing
      // webhooks, subscription activation, etc.) will silently no-op against
      // this placeholder. Callers MUST guard with isSupabaseAdminConfigured().
      if (process.env.NODE_ENV !== 'production') {
        console.error(
          '[Supabase] Admin client NOT configured — SUPABASE_SERVICE_ROLE_KEY is missing.\n' +
          'All server-side DB writes (billing webhooks, subscription updates, etc.) will silently fail.\n' +
          'Local: add it to .env.local. Production: Vercel → Project → Settings → Environment Variables, then redeploy.'
        );
      }
      return createClient('https://placeholder.supabase.co', 'placeholder-key');
    }

    supabaseAdminInstance = createClient(supabaseUrl, supabaseServiceRoleKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    });
  }
  return supabaseAdminInstance;
};

/**
 * Returns true ONLY when the server-side admin client has real credentials.
 *
 * Use this as an early guard in any API route that writes billing/subscription
 * data. Without it, a missing SUPABASE_SERVICE_ROLE_KEY causes supabaseAdmin to
 * silently fall back to a dummy client — and the route returns a misleading
 * 401/404 instead of telling the operator the key is missing.
 *
 * Mirrors the isStripeConfigured() / getMissingStripeConfig() pattern.
 */
export function isSupabaseAdminConfigured(): boolean {
  return Boolean(
    process.env.NEXT_PUBLIC_SUPABASE_URL &&
      process.env.SUPABASE_SERVICE_ROLE_KEY
  );
}

/**
 * Returns the list of missing server-side Supabase env vars, for diagnostics.
 */
export function getMissingSupabaseConfig(): string[] {
  const missing: string[] = [];
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL) missing.push('NEXT_PUBLIC_SUPABASE_URL');
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) missing.push('SUPABASE_SERVICE_ROLE_KEY');
  return missing;
}

// Export a proxy that lazily initializes admin client
export const supabaseAdmin = new Proxy({} as SupabaseClient, {
  get(_, prop) {
    return getSupabaseAdminClient()[prop as keyof SupabaseClient];
  }
});

export type DbResult<T> = T extends PromiseLike<infer U> ? U : never;
export type DbResultOk<T> = T extends PromiseLike<{ data: infer U }> ? Exclude<U, null> : never;
export type DbResultErr = PostgrestError;
