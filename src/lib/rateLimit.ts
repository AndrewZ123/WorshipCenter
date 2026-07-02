// Rate limiting middleware for API endpoints
// Uses in-memory storage for simplicity, can be upgraded to Redis for production

interface RateLimitStore {
  count: number;
  resetTime: number;
}

class RateLimiter {
  private store: Map<string, RateLimitStore> = new Map();
  private cleanupInterval: NodeJS.Timeout;

  constructor() {
    // Clean up expired entries every 5 minutes
    this.cleanupInterval = setInterval(() => {
      this.cleanup();
    }, 5 * 60 * 1000);
  }

  private cleanup() {
    const now = Date.now();
    for (const [key, value] of this.store.entries()) {
      if (value.resetTime < now) {
        this.store.delete(key);
      }
    }
  }

  check(identifier: string, limit: number, windowMs: number): {
    success: boolean;
    remaining: number;
    resetTime: number;
  } {
    const now = Date.now();
    const entry = this.store.get(identifier);

    if (!entry || entry.resetTime < now) {
      // Create new entry or reset expired one
      const resetTime = now + windowMs;
      this.store.set(identifier, {
        count: 1,
        resetTime,
      });
      return {
        success: true,
        remaining: limit - 1,
        resetTime,
      };
    }

    if (entry.count >= limit) {
      return {
        success: false,
        remaining: 0,
        resetTime: entry.resetTime,
      };
    }

    entry.count++;
    return {
      success: true,
      remaining: limit - entry.count,
      resetTime: entry.resetTime,
    };
  }

  reset(identifier: string) {
    this.store.delete(identifier);
  }

  destroy() {
    clearInterval(this.cleanupInterval);
    this.store.clear();
  }
}

// Global rate limiter instance
const globalLimiter = new RateLimiter();

// Rate limiting configuration
export const rateLimitConfig = {
  // Authentication endpoints - stricter limits
  auth: {
    limit: 5,
    windowMs: 15 * 60 * 1000, // 15 minutes
  },
  // General API endpoints
  api: {
    limit: 100,
    windowMs: 15 * 60 * 1000, // 15 minutes
  },
  // File uploads - stricter to prevent abuse
  upload: {
    limit: 20,
    windowMs: 15 * 60 * 1000, // 15 minutes
  },
  // Public endpoints
  public: {
    limit: 50,
    windowMs: 15 * 60 * 1000, // 15 minutes
  },
};

// Middleware function for API routes
export async function rateLimit(
  identifier: string,
  config: keyof typeof rateLimitConfig = 'api'
): Promise<{
  success: boolean;
  remaining: number;
  resetTime: number;
}> {
  const { limit, windowMs } = rateLimitConfig[config];
  return globalLimiter.check(identifier, limit, windowMs);
}

// Helper to create rate limit error response
export function rateLimitErrorResponse(remaining: number, resetTime: number) {
  return Response.json(
    {
      error: 'Too many requests',
      message: 'Rate limit exceeded. Please try again later.',
      retryAfter: Math.ceil((resetTime - Date.now()) / 1000),
    },
    {
      status: 429,
      headers: {
        'X-RateLimit-Limit': rateLimitConfig.api.limit.toString(),
        'X-RateLimit-Remaining': remaining.toString(),
        'X-RateLimit-Reset': new Date(resetTime).toISOString(),
        'Retry-After': Math.ceil((resetTime - Date.now()) / 1000).toString(),
      },
    }
  );
}

// Helper to add rate limit headers to successful responses
export function addRateLimitHeaders(
  response: Response,
  remaining: number,
  resetTime: number
): Response {
  response.headers.set('X-RateLimit-Limit', rateLimitConfig.api.limit.toString());
  response.headers.set('X-RateLimit-Remaining', remaining.toString());
  response.headers.set('X-RateLimit-Reset', new Date(resetTime).toISOString());
  return response;
}

export default globalLimiter;