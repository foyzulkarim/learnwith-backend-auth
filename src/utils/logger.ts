import pino from 'pino';
import path from 'path';
import fs from 'fs';
import { AsyncLocalStorage } from 'async_hooks';
import { logRotationManager } from './logRotation';
import { createLogglyTransport } from './logglyTransport';
import { LOG_DIR, LOG_LEVEL, LOGGLY_CONFIG } from './logConfig';

// Ensure logs directory exists
if (!fs.existsSync(LOG_DIR)) {
  fs.mkdirSync(LOG_DIR, { recursive: true });
}

// Run cleanup on startup
logRotationManager.cleanupOldLogs().catch((error) => {
  console.error('Error during startup log cleanup:', error);
});

// Get log level and environment from centralized config
const level = LOG_LEVEL;
const isProduction = process.env.NODE_ENV === 'production';

// Create rotating log file name (daily rotation)
const getLogFileName = () => {
  const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD format
  return path.join(LOG_DIR, `app-${today}.log`);
};

// Check if Loggly is configured from centralized config
const hasLoggly = LOGGLY_CONFIG.enabled;

// AsyncLocalStorage for correlation context
interface CorrelationStore {
  correlationId?: string;
  requestId?: string;
  sessionId?: string;
  userId?: string;
  userEmail?: string;
  userRole?: string;
  ip?: string;
  method?: string;
  url?: string;
}

export const asyncLocalStorage = new AsyncLocalStorage<CorrelationStore>();

// Custom log method to include correlation context
const withCorrelationContext = (obj: any = {}) => {
  const context = asyncLocalStorage.getStore();
  if (!context) {
    return obj;
  }

  // Add correlation context to the log object
  return {
    ...obj,
    correlationId: context.correlationId,
    requestId: context.requestId,
    sessionId: context.sessionId,
    userId: context.userId ? maskUserId(context.userId) : undefined,
    userEmail: context.userEmail ? maskEmail(context.userEmail) : undefined,
    userRole: context.userRole,
    ip: context.ip,
    method: context.method,
    url: context.url,
  };
};

// Import masking functions from centralized config

// Utility functions for masking sensitive data
function maskUserId(userId: string): string {
  if (userId.length <= 8) return userId;
  return userId.substring(0, 4) + '...' + userId.substring(userId.length - 4);
}

function maskEmail(email: string): string {
  const [local, domain] = email.split('@');
  if (!domain) return email;
  if (local.length <= 2) return `${local}***@${domain}`;
  return `${local.substring(0, 2)}***@${domain}`;
}

// Create a custom logger that wraps pino methods with correlation context
const createContextAwareLogger = (baseLogger: pino.Logger) => {
  const contextLogger = Object.create(baseLogger);

  // Override each log level method to include correlation context
  const logMethods = ['trace', 'debug', 'info', 'warn', 'error', 'fatal'] as const;

  logMethods.forEach((method) => {
    const originalMethod = baseLogger[method].bind(baseLogger);

    contextLogger[method] = (obj: any, msg?: string, ...args: any[]) => {
      // Handle different call signatures
      if (typeof obj === 'string') {
        // logger.info('message')
        return originalMethod(withCorrelationContext({}), obj, ...args);
      } else if (obj && typeof obj === 'object' && msg) {
        // logger.info({ key: value }, 'message')
        return originalMethod(withCorrelationContext(obj), msg, ...args);
      } else if (obj && typeof obj === 'object') {
        // logger.info({ key: value })
        return originalMethod(withCorrelationContext(obj));
      } else {
        // Fallback
        return originalMethod(withCorrelationContext({}), obj, msg, ...args);
      }
    };
  });

  return contextLogger;
};

// Create logger configuration
const loggerConfig: pino.LoggerOptions = {
  level,
  timestamp: pino.stdTimeFunctions.isoTime,
};

// Create streams for different destinations
const logFilePath = getLogFileName();
const fileDestination = pino.destination({
  dest: logFilePath,
  sync: false,
  mkdir: true,
});

let baseLogger: pino.Logger;

if (isProduction) {
  // Production: File logging + optional Loggly
  if (hasLoggly) {
    // Create multistream with file and Loggly using centralized config
    const logglyTransport = createLogglyTransport({
      token: LOGGLY_CONFIG.token,
      subdomain: LOGGLY_CONFIG.subdomain,
      tags: [...LOGGLY_CONFIG.tags, isProduction ? 'production' : 'development'],
    });

    // Create a multistream to send logs to both file and Loggly
    const multistream = pino.multistream([
      { stream: fileDestination, level },
      { stream: logglyTransport, level },
    ]);

    baseLogger = pino(loggerConfig, multistream);
    console.log('✅ Logger initialized with file and Loggly integration');
  } else {
    // Only file logging
    baseLogger = pino(loggerConfig, fileDestination);
    console.log('✅ Logger initialized with file logging only');
    console.log('💡 To enable Loggly, set LOGGLY_TOKEN and LOGGLY_SUBDOMAIN environment variables');
  }
} else {
  // Development: Pretty console + file
  if (process.stdout.isTTY) {
    // Terminal with pretty printing
    const prettyTransport = pino.transport({
      target: 'pino-pretty',
      options: {
        colorize: true,
        translateTime: 'SYS:standard',
        ignore: 'pid,hostname',
      },
    });

    // Create multistream for console and file
    const multistream = pino.multistream([
      { stream: prettyTransport, level },
      { stream: fileDestination, level },
    ]);

    baseLogger = pino(loggerConfig, multistream);
  } else {
    // Non-TTY environment (like CI/CD)
    baseLogger = pino(loggerConfig, fileDestination);
  }

  console.log('✅ Logger initialized for development with console and file output');
}

// Create the context-aware logger
const logger = createContextAwareLogger(baseLogger);

// Schedule daily cleanup (runs every 24 hours)
if (isProduction) {
  setInterval(
    () => {
      logRotationManager.cleanupOldLogs().catch((error) => {
        logger.error({ err: error }, 'Failed to run scheduled log cleanup');
      });
    },
    24 * 60 * 60 * 1000,
  ); // 24 hours
}

// Test the logger to ensure it's working
logger.info('Logger initialized successfully');
if (isProduction && hasLoggly) {
  logger.info('🚀 Loggly integration is active - logs are being sent to Loggly');
}

// Utility function to set correlation context
export const setCorrelationContext = (context: CorrelationStore) => {
  return asyncLocalStorage.run(context, () => {});
};

// Utility function to run code with correlation context
export const runWithCorrelationContext = <T>(context: CorrelationStore, fn: () => T): T => {
  return asyncLocalStorage.run(context, fn);
};

// Helper to get current correlation context
export const getCurrentCorrelationContext = (): CorrelationStore | undefined => {
  return asyncLocalStorage.getStore();
};

// Create a service logger that automatically includes correlation context when available
export const createServiceLogger = (serviceName: string) => {
  const serviceLogger = Object.create(logger);

  // Override each log level method to include service name and correlation context
  const logMethods = ['trace', 'debug', 'info', 'warn', 'error', 'fatal'] as const;

  logMethods.forEach((method) => {
    const originalMethod = logger[method].bind(logger);

    serviceLogger[method] = (obj: any, msg?: string, ...args: any[]) => {
      // Add service name to the log
      const serviceObj = {
        service: serviceName,
        ...(typeof obj === 'object' ? obj : {}),
      };

      // Handle different call signatures
      if (typeof obj === 'string') {
        // logger.info('message')
        return originalMethod(serviceObj, obj, ...args);
      } else if (obj && typeof obj === 'object' && msg) {
        // logger.info({ key: value }, 'message')
        return originalMethod(serviceObj, msg, ...args);
      } else if (obj && typeof obj === 'object') {
        // logger.info({ key: value })
        return originalMethod(serviceObj);
      } else {
        // Fallback
        return originalMethod(serviceObj, obj, msg, ...args);
      }
    };
  });

  return serviceLogger;
};

// Helper to check if we're in a request context
export const isInRequestContext = (): boolean => {
  const context = getCurrentCorrelationContext();
  return !!context?.requestId;
};

// Export the context-aware logger
export { logger };
export default logger;
