// src/utils/logging.ts
/**
 * Centralized logging configuration and utilities
 * This file serves as the main entry point for all logging functionality
 */

import { FastifyRequest } from 'fastify';
import { logger, createServiceLogger, getCurrentCorrelationContext } from './logger';
import { withLogglyTags } from './logglyHelper';
import { getCorrelationSummary } from './correlationContext';
import { getCallerInfo } from './logContext';

/**
 * Get a logger for a specific service or module
 * This ensures consistent logging format across the application
 *
 * @param serviceName Name of the service or module
 * @returns A logger instance with service context
 */
export function getLogger(serviceName: string) {
  const serviceLogger = createServiceLogger(serviceName);

  // Create a wrapper that adds source context to all logs
  const contextLogger = Object.create(serviceLogger);

  // Override each log level method to include source context
  const logMethods = ['trace', 'debug', 'info', 'warn', 'error', 'fatal'] as const;

  logMethods.forEach((method) => {
    const originalMethod = serviceLogger[method].bind(serviceLogger);

    contextLogger[method] = (obj: any, msg?: string, ...args: any[]) => {
      // Get caller information
      const { file, method: callerMethod } = getCallerInfo();
      const sourceInfo = file ? `${file}${callerMethod ? `:${callerMethod}` : ''}` : undefined;

      // Handle different call signatures
      if (typeof obj === 'string') {
        // logger.info('message')
        return originalMethod({ source: sourceInfo }, `[${sourceInfo}] ${obj}`, ...args);
      } else if (obj && typeof obj === 'object' && msg) {
        // logger.info({ key: value }, 'message')
        return originalMethod({ ...obj, source: sourceInfo }, `[${sourceInfo}] ${msg}`, ...args);
      } else if (obj && typeof obj === 'object') {
        // logger.info({ key: value })
        return originalMethod({ ...obj, source: sourceInfo });
      } else {
        // Fallback
        return originalMethod({ source: sourceInfo }, obj, msg, ...args);
      }
    };
  });

  return contextLogger;
}

/**
 * Add correlation ID to a log object
 * Use this when you need to manually include correlation context
 *
 * @param obj Object to enhance with correlation ID
 * @returns Enhanced object with correlation ID
 */
export function withCorrelationId(obj: Record<string, unknown> = {}): Record<string, unknown> {
  const context = getCurrentCorrelationContext();
  if (!context?.correlationId) {
    return obj;
  }

  return {
    ...obj,
    correlationId: context.correlationId,
  };
}

/**
 * Get correlation ID for the current context
 * Useful for passing to external services or including in responses
 *
 * @returns The current correlation ID or undefined if not in a request context
 */
export function getCorrelationId(): string | undefined {
  const context = getCurrentCorrelationContext();
  return context?.correlationId;
}

/**
 * Create a log object with standard metadata for business events
 *
 * @param eventType Type of business event (e.g., 'user.created', 'course.enrolled')
 * @param data Event data to log
 * @returns Log object with standard metadata
 */
export function createEventLog(
  eventType: string,
  data: Record<string, unknown> = {},
): Record<string, unknown> {
  return {
    eventType,
    timestamp: new Date().toISOString(),
    ...withCorrelationId(data),
    ...withLogglyTags(['business-event', eventType.split('.')[0]]),
  };
}

/**
 * Log a business event with standard format
 *
 * @param eventType Type of business event (e.g., 'user.created', 'course.enrolled')
 * @param data Event data to log
 * @param message Optional message describing the event
 */
export function logBusinessEvent(
  eventType: string,
  data: Record<string, unknown> = {},
  message?: string,
): void {
  const { file, method } = getCallerInfo();
  const sourceInfo = file ? `${file}${method ? `:${method}` : ''}` : 'unknown';

  const eventLog = {
    ...createEventLog(eventType, data),
    source: sourceInfo,
  };

  const formattedMessage = message
    ? `[${sourceInfo}] ${eventType}: ${message}`
    : `[${sourceInfo}] ${eventType}`;
  logger.info(eventLog, formattedMessage);
}

/**
 * Get correlation summary for a request
 * Useful for including in API responses or error messages
 *
 * @param request Fastify request object
 * @returns Correlation summary object or null if not available
 */
export function getRequestCorrelation(request: FastifyRequest) {
  return getCorrelationSummary(request);
}

/**
 * Log an error with correlation context
 *
 * @param error Error object to log
 * @param context Additional context for the error
 * @param message Optional message describing the error
 */
export function logError(
  error: Error,
  context: Record<string, unknown> = {},
  message?: string,
): void {
  const { file, method } = getCallerInfo();
  const sourceInfo = file ? `${file}${method ? `:${method}` : ''}` : 'unknown';

  const errorContext = {
    ...withCorrelationId(context),
    errorType: error.constructor.name,
    source: sourceInfo,
    ...withLogglyTags(['error', 'exception']),
  };

  const errorMessage = message || error.message || 'An error occurred';
  logger.error({ err: error, ...errorContext }, `[${sourceInfo}] ${errorMessage}`);
}

// Re-export key logging utilities for convenience
export { logger } from './logger';
export { withLogglyTags } from './logglyHelper';
export { isLogglyEnabled } from './logglyHelper';
