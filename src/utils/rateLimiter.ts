import { FastifyRequest, FastifyReply } from 'fastify';
import { AppError } from './errors';

interface RateLimitOptions {
  windowMs: number; // Time window in milliseconds
  maxRequests: number; // Maximum number of requests per window
  message?: string;
  name?: string; // Name for logging purposes
}

interface RequestRecord {
  count: number;
  resetTime: number;
}

// In-memory store for rate limiting (consider Redis for production)
const requestStore = new Map<string, RequestRecord>();

// Cleanup old entries periodically
const cleanupInterval = setInterval(() => {
  const now = Date.now();
  const keysToDelete: string[] = [];

  for (const [key, record] of requestStore.entries()) {
    if (now > record.resetTime) {
      keysToDelete.push(key);
    }
  }

  if (keysToDelete.length > 0) {
    keysToDelete.forEach((key) => requestStore.delete(key));

    // Log cleanup activity (sample at a lower rate to avoid log spam)
    if (keysToDelete.length > 10) {
      console.info(
        {
          operation: 'rate_limiter_cleanup',
          cleanedKeys: keysToDelete.length,
          totalKeys: requestStore.size,
          timestamp: new Date().toISOString(),
        },
        `Rate limiter cleanup: removed ${keysToDelete.length} expired entries`,
      );
    }
  }
}, 60000); // Clean up every minute

// Handle graceful shutdown
process.on('SIGTERM', () => {
  clearInterval(cleanupInterval);
});

process.on('SIGINT', () => {
  clearInterval(cleanupInterval);
});

/**
 * Rate limiting middleware
 */
export function rateLimit(options: RateLimitOptions) {
  const {
    windowMs,
    maxRequests,
    message = 'Too many requests, please try again later.',
    name = 'rate_limit',
  } = options;

  return async (request: FastifyRequest, reply: FastifyReply): Promise<void> => {
    const startTime = Date.now();
    const clientIP = request.ip;
    const now = Date.now();
    const key = `${clientIP}:${request.url}`;
    const userAgent = request.headers['user-agent'] || 'unknown';

    request.server.log.debug(
      {
        operation: 'rate_limiter',
        step: 'checking',
        name,
        clientIP,
        url: request.url,
        method: request.method,
        requestId: request.id,
        windowMs,
        maxRequests,
      },
      'Rate limit check started',
    );

    // Get or create request record
    let record = requestStore.get(key);
    const isNewRecord = !record;
    const isExpiredRecord = record && now > record.resetTime;

    if (!record || now > record.resetTime) {
      // Create new record or reset expired record
      record = {
        count: 0,
        resetTime: now + windowMs,
      };
      requestStore.set(key, record);

      if (isExpiredRecord) {
        request.server.log.debug(
          {
            operation: 'rate_limiter',
            step: 'record_reset',
            name,
            clientIP,
            url: request.url,
            requestId: request.id,
          },
          'Rate limit record reset for expired window',
        );
      } else if (isNewRecord) {
        request.server.log.debug(
          {
            operation: 'rate_limiter',
            step: 'record_created',
            name,
            clientIP,
            url: request.url,
            requestId: request.id,
          },
          'New rate limit record created',
        );
      }
    }

    // Increment request count
    const previousCount = record.count;
    record.count++;

    const remaining = Math.max(0, maxRequests - record.count);
    const resetTimeSeconds = Math.ceil((record.resetTime - now) / 1000);

    request.server.log.debug(
      {
        operation: 'rate_limiter',
        step: 'count_updated',
        name,
        clientIP,
        url: request.url,
        requestId: request.id,
        previousCount,
        currentCount: record.count,
        maxRequests,
        remaining,
        resetTimeSeconds,
      },
      `Rate limit count: ${record.count}/${maxRequests} (${remaining} remaining)`,
    );

    // Check if limit exceeded
    if (record.count > maxRequests) {
      const duration = Date.now() - startTime;

      request.server.log.warn(
        {
          operation: 'rate_limiter',
          step: 'limit_exceeded',
          name,
          clientIP,
          url: request.url,
          method: request.method,
          userAgent,
          requestId: request.id,
          count: record.count,
          maxRequests,
          windowMs,
          resetTimeSeconds,
          duration,
          excessRequests: record.count - maxRequests,
        },
        `Rate limit exceeded: ${record.count}/${maxRequests} requests in ${windowMs}ms window`,
      );

      // Log business metrics for rate limiting violations
      request.server.log.info(
        {
          metric: 'rate_limit_violation',
          name,
          clientIP,
          url: request.url,
          method: request.method,
          userAgent,
          count: record.count,
          maxRequests,
          windowMs,
          excessRequests: record.count - maxRequests,
          timestamp: new Date().toISOString(),
        },
        'Rate limit violation metric',
      );

      reply.header('X-RateLimit-Limit', maxRequests);
      reply.header('X-RateLimit-Remaining', 0);
      reply.header('X-RateLimit-Reset', resetTimeSeconds);
      reply.header('Retry-After', resetTimeSeconds);

      throw new AppError(message, 429, 'RATE_LIMIT_EXCEEDED');
    }

    // Add rate limit headers
    reply.header('X-RateLimit-Limit', maxRequests);
    reply.header('X-RateLimit-Remaining', remaining);
    reply.header('X-RateLimit-Reset', resetTimeSeconds);

    const duration = Date.now() - startTime;

    request.server.log.debug(
      {
        operation: 'rate_limiter',
        step: 'allowed',
        name,
        clientIP,
        url: request.url,
        requestId: request.id,
        count: record.count,
        maxRequests,
        remaining,
        duration,
      },
      `Rate limit check passed: ${record.count}/${maxRequests} (${remaining} remaining) in ${duration}ms`,
    );

    // Log metrics for rate limit usage (sample to avoid log spam)
    if (record.count === 1 || record.count % 10 === 0 || remaining <= 5) {
      request.server.log.info(
        {
          metric: 'rate_limit_usage',
          name,
          clientIP,
          url: request.url,
          count: record.count,
          maxRequests,
          remaining,
          utilization: Math.round((record.count / maxRequests) * 100),
          timestamp: new Date().toISOString(),
        },
        'Rate limit usage metric',
      );
    }
  };
}

// Pre-configured rate limiters for common use cases
export const authRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  maxRequests: 5, // 5 auth attempts per 15 minutes
  message: 'Too many authentication attempts. Please try again later.',
  name: 'auth_rate_limit',
});

export const apiRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  maxRequests: 100, // 100 requests per 15 minutes
  message: 'Too many API requests. Please try again later.',
  name: 'api_rate_limit',
});

export const strictRateLimit = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  maxRequests: 10, // 10 requests per minute
  message: 'Rate limit exceeded. Please slow down.',
  name: 'strict_rate_limit',
});
