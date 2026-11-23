import { checkRateLimit } from '@/lib/auth-middleware';

/**
 * Consume a rate-limit bucket so the next matching request is denied.
 *
 * API routes build keys from `getClientIp` or the authenticated user id, so
 * tests pass the same key the route uses and then call the handler once.
 */
export function exhaustRateLimit(
  key: string,
  tier: { requests: number; window: number }
): void {
  for (let i = 0; i < tier.requests; i++) {
    checkRateLimit(key, tier.requests, tier.window);
  }
}
