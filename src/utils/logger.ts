import { FastifyInstance } from 'fastify';

export interface LogContext {
  operation: string;
  requestId?: string;
  userId?: string;
  [key: string]: any;
}

export interface PerformanceLogContext extends LogContext {
  startTime: number;
  duration?: number;
}

export class Logger {
  constructor(private fastify: FastifyInstance) {}

  private enrichContext(context: LogContext): LogContext {
    // Try to get the current request ID from the request context
    try {
      // Access the current request context store
      const store = (this.fastify as any).requestContext?.store;
      const request = store?.get('request');

      if (request?.id && !context.requestId) {
        context.requestId = request.id;
      }
    } catch {
      // Request context not available (e.g., during startup), continue without it
      console.log('Request context not available');
    }

    return context;
  }

  info(context: LogContext, message: string) {
    this.fastify.log.info(this.enrichContext(context), message);
  }

  warn(context: LogContext, message: string) {
    this.fastify.log.warn(this.enrichContext(context), message);
  }

  error(context: LogContext, message: string) {
    this.fastify.log.error(this.enrichContext(context), message);
  }

  debug(context: LogContext, message: string) {
    this.fastify.log.debug(this.enrichContext(context), message);
  }

  // Performance logging helpers
  startOperation(
    operation: string,
    additionalContext: Partial<LogContext> = {},
  ): PerformanceLogContext {
    const context: PerformanceLogContext = {
      operation,
      startTime: Date.now(),
      ...additionalContext,
    };

    this.info(context, `Starting operation: ${operation}`);
    return context;
  }

  endOperation(
    context: PerformanceLogContext,
    message?: string,
    additionalContext: Partial<LogContext> = {},
  ) {
    const duration = Date.now() - context.startTime;
    const finalContext = {
      ...context,
      duration,
      success: true,
      ...additionalContext,
    };

    this.info(
      finalContext,
      message || `Completed operation: ${context.operation} in ${duration}ms`,
    );
    return finalContext;
  }

  errorOperation(
    context: PerformanceLogContext,
    error: Error | unknown,
    message?: string,
    additionalContext: Partial<LogContext> = {},
  ) {
    const duration = Date.now() - context.startTime;
    const errorContext = {
      ...context,
      duration,
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      errorType: error?.constructor?.name,
      ...additionalContext,
    };

    this.error(
      errorContext,
      message || `Failed operation: ${context.operation} after ${duration}ms`,
    );
    return errorContext;
  }

  // Business metrics logging
  logMetric(metric: string, data: Record<string, any>, message?: string) {
    this.fastify.log.info(
      {
        operation: `metric:${metric}`,
        metric,
        timestamp: new Date().toISOString(),
        ...data,
      },
      message || `Business metric: ${metric}`,
    );
  }
}

// Factory function to create logger instances
export function createLogger(fastify: FastifyInstance): Logger {
  return new Logger(fastify);
}

// Utility function to get current request ID from anywhere in the app
export function getCurrentRequestId(fastify: FastifyInstance): string | undefined {
  try {
    const store = (fastify as any).requestContext?.store;
    const request = store?.get('request');
    return request?.id;
  } catch {
    return undefined;
  }
}
