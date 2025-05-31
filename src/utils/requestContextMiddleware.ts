// src/utils/requestContextMiddleware.ts
import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { nanoid } from 'nanoid';
import { shouldSampleLog, withSamplingInfo } from './logSampler';
import { withLogglyTags } from './logglyHelper';

/**
 * Middleware that enriches each request with context information
 * and sets up log enrichment for better tracing
 */
export function registerRequestContextMiddleware(fastify: FastifyInstance): void {
  // Add hook to enrich all requests with context
  fastify.addHook('onRequest', async (request: FastifyRequest, _reply: FastifyReply) => {
    // Generate a unique request ID if not already present
    // This helps with tracing request flows through the system
    if (!request.id) {
      request.id = nanoid(10);
    }
    
    // Check if this request should be sampled for detailed logging
    const isSampled = shouldSampleLog(request);
    
    // Store sampling decision and other context on the request object
    // Note: TypeScript needs a custom declaration merge to properly type this
    // For now, we'll use any type to store our context
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (request as any).loggingContext = {
      isSampled,
      startTime: Date.now(),
      url: request.url,
      method: request.method,
      requestId: request.id,
      userAgent: request.headers['user-agent'] || 'unknown',
      ip: request.ip,
      referrer: request.headers.referer || 'direct',
    };

    // Decorate the request.log with methods that automatically include context
    const originalLogger = request.log;
    
    // Replace the log methods to automatically include context
    // Create type-safe overrides for each log level
    const logLevels = ['info', 'error', 'warn', 'debug', 'trace', 'fatal'] as const;
    logLevels.forEach((level) => {
      const originalMethod = originalLogger[level].bind(originalLogger);
      
      // Override the method to include our context with proper typing
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (originalLogger[level] as any) = (obj: any, msg?: string, ...args: any[]) => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const context = (request as any).loggingContext;
        
        let logObj = {};
        
        // Handle string-only logs
        if (typeof obj === 'string') {
          msg = obj;
          logObj = {};
        } else {
          logObj = obj || {};
        }
        
        // Create the enhanced object with context
        const enhancedObj = {
          ...logObj,
          requestId: context.requestId,
          url: context.url,
          method: context.method,
          ...withSamplingInfo({}, context.isSampled),
          ...withLogglyTags(['request']),
        };
        
        // Call the original method with our enhanced object
        if (msg) {
          return originalMethod(enhancedObj, msg, ...args);
        } 
        return originalMethod(enhancedObj);
      };
    });
  });

  // Add hook to log request completion with timing information
  fastify.addHook('onResponse', (request: FastifyRequest, reply: FastifyReply, done) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const context = (request as any).loggingContext;
    
    if (context) {
      const duration = Date.now() - context.startTime;
      
      // Only log detailed timing for sampled requests or if there was an error
      if (context.isSampled || reply.statusCode >= 400) {
        request.log.info({
          statusCode: reply.statusCode,
          duration,
          ...withLogglyTags(['response', 'timing']),
        }, `Request completed in ${duration}ms`);
      }
    }
    
    done();
  });

  // Add hook to log errors with full context
  fastify.addHook('onError', (request: FastifyRequest, reply: FastifyReply, error, done) => {
    // Always log errors with full context, regardless of sampling
    request.log.error({
      err: error,
      statusCode: reply.statusCode,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      requestId: (request as any).loggingContext?.requestId || request.id,
      ...withLogglyTags(['error', 'exception']),
    }, error.message || 'Request error occurred');
    
    done();
  });
}
