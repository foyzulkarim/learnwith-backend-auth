import { FastifyRequest, FastifyReply } from 'fastify';
import { AppError } from './errors';

interface RateLimitOptions {
  windowMs: number; // Time window in milliseconds
  maxRequests: number; // Maximum number of requests per window
  message?: string;
  skipSuccessfulRequests?: boolean;
  skipFailedRequests?: boolean;
}

interface RequestRecord {
  count: number;
  resetTime: number;
}

// In-memory store for rate limiting (consider Redis for production)
const requestStore = new Map<string, RequestRecord>();

// Cleanup old entries periodically
setInterval(() => {
  const now = Date.now();
  for (const [key, record] of requestStore.entries()) {
    if (now > record.resetTime) {
      requestStore.delete(key);
    }
  }
}, 60000); // Clean up every minute

/**
 * Rate limiting middleware
 */
export function rateLimit(options: RateLimitOptions) {
  const {
    windowMs,
    maxRequests,
    message = 'Too many requests, please try again later.',
    skipSuccessfulRequests = false,
    skipFailedRequests = false,
  } = options;

  return async (request: FastifyRequest, reply: FastifyReply): Promise<void> => {
    const clientIP = request.ip;
    const now = Date.now();
    const key = `${clientIP}:${request.url}`;

    // Get or create request record
    let record = requestStore.get(key);

    if (!record || now > record.resetTime) {
      // Create new record or reset expired record
      record = {
        count: 0,
        resetTime: now + windowMs,
      };
      requestStore.set(key, record);
    }

    // Increment request count
    record.count++;

    // Check if limit exceeded
    if (record.count > maxRequests) {
      const resetTimeSeconds = Math.ceil((record.resetTime - now) / 1000);

      reply.header('X-RateLimit-Limit', maxRequests);
      reply.header('X-RateLimit-Remaining', 0);
      reply.header('X-RateLimit-Reset', resetTimeSeconds);
      reply.header('Retry-After', resetTimeSeconds);

      throw new AppError(message, 429, 'RATE_LIMIT_EXCEEDED');
    }

    // Add rate limit headers
    reply.header('X-RateLimit-Limit', maxRequests);
    reply.header('X-RateLimit-Remaining', Math.max(0, maxRequests - record.count));
    reply.header('X-RateLimit-Reset', Math.ceil((record.resetTime - now) / 1000));

    // Hook to handle successful/failed responses
    reply.addHook('onSend', async (request, reply, payload) => {
      const statusCode = reply.statusCode;
      const isSuccess = statusCode >= 200 && statusCode < 300;
      const isError = statusCode >= 400;

      // Optionally skip counting successful or failed requests
      if ((skipSuccessfulRequests && isSuccess) || (skipFailedRequests && isError)) {
        const currentRecord = requestStore.get(key);
        if (currentRecord && currentRecord.count > 0) {
          currentRecord.count--;
        }
      }

      return payload;
    });
  };
}

// Pre-configured rate limiters for common use cases
export const authRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  maxRequests: 5, // 5 auth attempts per 15 minutes
  message: 'Too many authentication attempts. Please try again later.',
});

export const apiRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  maxRequests: 100, // 100 requests per 15 minutes
  message: 'Too many API requests. Please try again later.',
});

export const strictRateLimit = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  maxRequests: 10, // 10 requests per minute
  message: 'Rate limit exceeded. Please slow down.',
});
