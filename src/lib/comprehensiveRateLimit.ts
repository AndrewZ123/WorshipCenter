interface RateLimitOptions {
  // Number of requests allowed in the window
  requests: number;
  // Time window in milliseconds
  window: number;
  // Unique identifier for the rate limit (e.g., 'signup', 'login', 'api')
  identifier: string;
}

interface RateLimitResult {
  success: boolean;
  limit: number;
  remaining: number;
  reset: number;
  retryAfter?: number;
}

// In-memory cache for rate limiting (in production, consider using Redis)
// Simple Map-based cache with TTL eviction
const rateLimitCache = new Map<string, { count: number; resetTime: number }>();
const RATE_LIMIT_MAX_ENTRIES = 10000;
const RATE_LIMIT_TTL = 60000 * 60; // 1 hour TTL

// Periodically evict expired entries to prevent unbounded growth
function evictExpiredEntries() {
  const now = Date.now();
  for (const [key, entry] of rateLimitCache.entries()) {
    if (entry.resetTime <= now) {
      rateLimitCache.delete(key);
    }
  }
}
setInterval(evictExpiredEntries, RATE_LIMIT_TTL).unref?.();

/**
 * Comprehensive rate limiting with different tiers for different operations
 */
export async function rateLimit(
  identifier: string,
  options: RateLimitOptions
): Promise<RateLimitResult> {
  const key = `${options.identifier}:${identifier}`;
  const now = Date.now();
  const windowStart = now - options.window;

  // Get or create rate limit entry
  let entry = rateLimitCache.get(key);

  // Reset if window has passed
  if (!entry || entry.resetTime <= now) {
    entry = {
      count: 0,
      resetTime: now + options.window,
    };
  }

  // Increment count
  entry.count += 1;
  rateLimitCache.set(key, entry);

  const remaining = Math.max(0, options.requests - entry.count);
  const success = entry.count <= options.requests;

  return {
    success,
    limit: options.requests,
    remaining,
    reset: entry.resetTime,
    retryAfter: !success ? Math.ceil((entry.resetTime - now) / 1000) : undefined,
  };
}

/**
 * Rate limiting tiers for different operations
 */
export const RateLimitTiers = {
  // Strict limits for authentication operations
  SIGNUP: { requests: 5, window: 60 * 60 * 1000 }, // 5 requests per hour
  LOGIN: { requests: 10, window: 15 * 60 * 1000 }, // 10 requests per 15 minutes
  PASSWORD_RESET: { requests: 3, window: 60 * 60 * 1000 }, // 3 requests per hour

  // Moderate limits for API operations
  API_GENERAL: { requests: 100, window: 60 * 1000 }, // 100 requests per minute
  API_READ: { requests: 300, window: 60 * 1000 }, // 300 requests per minute
  API_WRITE: { requests: 50, window: 60 * 1000 }, // 50 requests per minute

  // Lenient limits for billing operations (should be protected by auth anyway)
  BILLING: { requests: 20, window: 60 * 60 * 1000 }, // 20 requests per hour

  // Strict limits for sensitive operations
  TEAM_INVITATION: { requests: 10, window: 60 * 60 * 1000 }, // 10 requests per hour
  NOTIFICATION_SEND: { requests: 50, window: 60 * 60 * 1000 }, // 50 requests per hour
};

/**
 * Get client identifier from request (IP address + user agent)
 */
export function getClientIdentifier(request: Request): string {
  const ip = request.headers.get('x-forwarded-for') ||
             request.headers.get('x-real-ip') ||
             'unknown';
  const userAgent = request.headers.get('user-agent') || 'unknown';
  
  // Hash the combination to create a unique identifier
  const crypto = require('crypto');
  const hash = crypto
    .createHash('sha256')
    .update(`${ip}:${userAgent}`)
    .digest('hex');
  
  return hash.substring(0, 16);
}

/**
 * Express.js middleware wrapper for rate limiting
 */
export function rateLimitMiddleware(tier: RateLimitOptions) {
  return async (req: any, res: any, next: any) => {
    try {
      const identifier = getClientIdentifier(req);
      const result = await rateLimit(identifier, {
        requests: tier.requests,
        window: tier.window,
        identifier: tier.identifier || 'middleware',
      });

      // Set rate limit headers
      res.setHeader('X-RateLimit-Limit', result.limit);
      res.setHeader('X-RateLimit-Remaining', result.remaining);
      res.setHeader('X-RateLimit-Reset', result.reset);

      if (!result.success) {
        res.setHeader('Retry-After', result.retryAfter);
        return res.status(429).json({
          error: 'Too many requests',
          message: 'Rate limit exceeded. Please try again later.',
          retryAfter: result.retryAfter,
        });
      }

      next();
    } catch (error) {
      console.error('Rate limiting error:', error);
      // Fail open - don't block requests if rate limiting fails
      next();
    }
  };
}

/**
 * Next.js API route wrapper for rate limiting
 */
export function withRateLimit(
  handler: (req: Request, context?: any) => Promise<Response>,
  tier: RateLimitOptions
) {
  return async (req: Request, context?: any) => {
    try {
      const identifier = getClientIdentifier(req);
      const result = await rateLimit(identifier, {
        requests: tier.requests,
        window: tier.window,
        identifier: tier.identifier || 'api',
      });

      // Create response headers
      const headers = new Headers();
      headers.set('X-RateLimit-Limit', result.limit.toString());
      headers.set('X-RateLimit-Remaining', result.remaining.toString());
      headers.set('X-RateLimit-Reset', result.reset.toString());

      if (!result.success) {
        headers.set('Retry-After', result.retryAfter?.toString() || '60');
        return new Response(
          JSON.stringify({
            error: 'Too many requests',
            message: 'Rate limit exceeded. Please try again later.',
            retryAfter: result.retryAfter,
          }),
          {
            status: 429,
            headers,
          }
        );
      }

      // Call the original handler
      const response = await handler(req, context);

      // Add rate limit headers to the response
      Object.entries(Object.fromEntries(headers.entries())).forEach(([key, value]) => {
        response.headers.set(key, value);
      });

      return response;
    } catch (error) {
      console.error('Rate limiting error:', error);
      // Fail open - don't block requests if rate limiting fails
      return handler(req, context);
    }
  };
}