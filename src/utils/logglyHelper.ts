// src/utils/logglyHelper.ts
import { FastifyInstance } from 'fastify';

/**
 * Helper functions for advanced Loggly integration
 */

/**
 * Check if Loggly integration is enabled based on environment variables
 * @returns boolean indicating if Loggly is configured
 */
export function isLogglyEnabled(): boolean {
  return Boolean(process.env.LOGGLY_TOKEN && process.env.LOGGLY_SUBDOMAIN);
}

/**
 * Add Loggly context tags to a log message
 * This can be useful for adding specific context to certain log messages
 *
 * @param tags Tags to add to the log entry in Loggly
 * @returns Object to spread into a log message
 */
export function withLogglyTags(tags: string[]): Record<string, unknown> {
  if (isLogglyEnabled()) {
    return {
      _loggly: {
        tags: tags,
      },
    };
  }
  return {};
}

/**
 * Add user context to a log message suitable for Loggly
 * This anonymizes user data while still allowing for user-specific tracing
 *
 * @param userId The user's ID (will be partially masked)
 * @param userInfo Optional additional user context
 * @returns Object to spread into a log message
 */
export function withUserContext(
  userId: string | undefined,
  userInfo: Record<string, unknown> = {},
): Record<string, unknown> {
  if (!userId) {
    return { userContext: { anonymous: true } };
  }

  // Mask the userId for privacy
  const maskedId =
    userId.length > 8
      ? `${userId.substring(0, 4)}...${userId.substring(userId.length - 4)}`
      : '***masked***';

  return {
    userContext: {
      hasUserId: true,
      userIdHash: hashForLogging(userId),
      maskedId,
      ...userInfo,
    },
    ...withLogglyTags(['user-action']),
  };
}

/**
 * Generate a simple hash of a string for logging purposes
 * This allows for user activity correlation without exposing the actual ID
 *
 * @param value The string to hash
 * @returns A numeric hash code
 */
function hashForLogging(value: string): number {
  let hash = 0;
  for (let i = 0; i < value.length; i++) {
    const char = value.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash = hash & hash; // Convert to 32bit integer
  }
  return Math.abs(hash);
}

/**
 * Log system startup information with appropriate Loggly tags
 *
 * @param fastify Fastify instance
 */
export function logSystemInfo(fastify: FastifyInstance): void {
  const nodeEnv = process.env.NODE_ENV || 'development';
  const isProduction = nodeEnv === 'production';

  // Create a detailed startup log that will be useful in Loggly
  const startupInfo = {
    system: 'LearnWith Backend',
    environment: nodeEnv,
    logglyEnabled: isLogglyEnabled(),
    version: process.env.npm_package_version || 'unknown',
    node: process.version,
    ...withLogglyTags(['startup', nodeEnv]),
  };

  fastify.log.info(startupInfo, 'System startup complete');

  // Log warning if in production without Loggly
  if (isProduction && !isLogglyEnabled()) {
    fastify.log.warn(
      'Running in production without Loggly integration. Consider adding LOGGLY_TOKEN and LOGGLY_SUBDOMAIN to your environment variables.',
    );
  }
}
