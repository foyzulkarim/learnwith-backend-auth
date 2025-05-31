// src/utils/requestContextMiddleware.ts
import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { nanoid } from 'nanoid';
import { shouldSampleLog, withSamplingInfo } from './logSampler';
import { withLogglyTags } from './logglyHelper';
import {
  createCorrelationContext,
  createLogContext,
  CorrelationContext,
  getCorrelationContext,
} from './correlationContext';
import { asyncLocalStorage, runWithCorrelationContext } from './logger';
import { getCorrelationId } from './logging';

// Extend FastifyRequest type to include correlation context
declare module 'fastify' {
  interface FastifyRequest {
    correlationContext?: CorrelationContext;
  }
}

/**
 * Middleware that enriches each request with correlation context information
 * and sets up log enrichment for better user and session tracing
 */
export function registerRequestContextMiddleware(fastify: FastifyInstance): void {
  // Add hook to enrich all requests with correlation context
  fastify.addHook('onRequest', async (request: FastifyRequest, _reply: FastifyReply) => {
    // Generate a unique request ID if not already present
    if (!request.id) {
      request.id = nanoid(10);
    }

    // Create correlation context for this request
    const correlationContext = createCorrelationContext(request);
    request.correlationContext = correlationContext;

    // Set up AsyncLocalStorage context for centralized logging
    const asyncContext = {
      correlationId: correlationContext.correlationId,
      requestId: correlationContext.requestId,
      sessionId: correlationContext.sessionId,
      userId: correlationContext.userId,
      userEmail: correlationContext.userEmail,
      userRole: correlationContext.userRole,
      ip: correlationContext.ip,
      method: correlationContext.method,
      url: correlationContext.url,
    };

    // Run the rest of the request processing within the correlation context
    return new Promise<void>((resolve, reject) => {
      runWithCorrelationContext(asyncContext, () => {
        try {
          // Check if this request should be sampled for detailed logging
          const isSampled = shouldSampleLog(request);

          // Create base log context with correlation information
          const baseLogContext = {
            ...createLogContext(correlationContext),
            isSampled,
          };

          // Decorate the request.log with methods that automatically include correlation context
          const originalLogger = request.log;

          // Replace the log methods to automatically include correlation context
          const logLevels = ['info', 'error', 'warn', 'debug', 'trace', 'fatal'] as const;
          logLevels.forEach((level) => {
            const originalMethod = originalLogger[level].bind(originalLogger);

            // Override the method to include our correlation context
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            (originalLogger[level] as any) = (obj: any, msg?: string, ...args: any[]) => {
              let logObj = {};

              // Handle string-only logs
              if (typeof obj === 'string') {
                msg = obj;
                logObj = {};
              } else {
                logObj = obj || {};
              }

              // Create the enhanced object with correlation context
              const enhancedObj = {
                ...logObj,
                ...baseLogContext,
                ...withSamplingInfo({}, isSampled),
                ...withLogglyTags(['request', 'correlation']),
              };

              // Call the original method with our enhanced object
              if (msg) {
                return originalMethod(enhancedObj, msg, ...args);
              }
              return originalMethod(enhancedObj);
            };
          });

          // Log the request initiation with correlation context
          request.log.info('Request initiated with correlation tracking');
          resolve();
        } catch (error) {
          reject(error);
        }
      });
    });
  });

  // Add hook after authentication to update correlation context with user info
  fastify.addHook('preHandler', async (request: FastifyRequest, _reply: FastifyReply) => {
    // Update correlation context if user information is now available
    const context = getCorrelationContext(request);
    if (context && request.user && !context.userId) {
      // User was authenticated after initial context creation
      context.userId = request.user.id;
      context.userEmail = request.user.email;
      context.userRole = request.user.role;

      // Update the AsyncLocalStorage context as well
      const currentAsyncContext = asyncLocalStorage.getStore();
      if (currentAsyncContext) {
        currentAsyncContext.userId = request.user.id;
        currentAsyncContext.userEmail = request.user.email;
        currentAsyncContext.userRole = request.user.role;
      }

      // Update the base log context for subsequent logs
      const updatedLogContext = createLogContext(context);

      // Re-decorate the logger with updated context
      const originalLogger = request.log;
      const logLevels = ['info', 'error', 'warn', 'debug', 'trace', 'fatal'] as const;

      logLevels.forEach((level) => {
        const originalMethod = originalLogger[level].bind(originalLogger);

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (originalLogger[level] as any) = (obj: any, msg?: string, ...args: any[]) => {
          let logObj = {};

          if (typeof obj === 'string') {
            msg = obj;
            logObj = {};
          } else {
            logObj = obj || {};
          }

          const enhancedObj = {
            ...logObj,
            ...updatedLogContext,
            ...withLogglyTags(['request', 'correlation', 'authenticated']),
          };

          if (msg) {
            return originalMethod(enhancedObj, msg, ...args);
          }
          return originalMethod(enhancedObj);
        };
      });

      request.log.info('User context added to correlation tracking');
    }
  });

  // Add hook to log request completion with timing and final correlation information
  fastify.addHook('onResponse', (request: FastifyRequest, reply: FastifyReply, done) => {
    const context = getCorrelationContext(request);

    if (context) {
      const duration = Date.now() - context.startTime;

      // Always log completion for authenticated users or errors
      if (context.userId || reply.statusCode >= 400) {
        request.log.info(
          {
            statusCode: reply.statusCode,
            duration,
            responseSize: reply.getHeader('content-length') || 0,
            ...withLogglyTags(['response', 'timing', 'completion']),
          },
          `Request completed in ${duration}ms`,
        );
      }

      // Add correlation ID to response headers for debugging
      try {
        const correlationId = getCorrelationId();
        if (correlationId) {
          reply.header('X-Correlation-ID', correlationId);
        }
      } catch (err) {
        // Ignore errors from getCorrelationId if it's not fully implemented yet
        // eslint-disable-next-line no-console
        console.error('Error retrieving correlation ID:', err);
      }
    }

    done();
  });

  // Add hook to log errors with full correlation context
  fastify.addHook('onError', (request: FastifyRequest, reply: FastifyReply, error, done) => {
    // Always log errors with full correlation context
    request.log.error(
      {
        err: error,
        statusCode: reply.statusCode,
        errorType: error.constructor.name,
        ...withLogglyTags(['error', 'exception', 'correlation']),
      },
      error.message || 'Request error occurred',
    );

    done();
  });
}
