// src/app.ts
import Fastify, { FastifyInstance } from 'fastify';
import { config, isDev } from './config'; // Load validated config
import { isAppError, convertToAppError } from './utils/errors'; // Import error utilities
import { v4 as uuidv4 } from 'uuid'; // Import UUID for proper request IDs

// Import plugins
import jwtPlugin from './plugins/jwt';
import oauth2Plugin from './plugins/oauth2';
import mongoosePlugin from './plugins/mongoose'; // MongoDB connection plugin

// Import routes
import authRoutes from './modules/auth/auth.route';
import courseRoutes from './modules/course/course.route';
// import videoRoutes from './modules/course/video.route';
import hlsRoutes from './modules/course/hls.route';
import enrollmentModule from './modules/enrollment';
import { userRoutes } from './modules/user/user.route';
// Import other module routes (e.g., userRoutes) if you have them

import type { PinoLoggerOptions } from 'fastify/types/logger';
import { resolve } from 'path';
import { mkdirSync } from 'fs';

// Create logger configuration based on environment and config
function createLoggerConfig(): PinoLoggerOptions {
  const baseConfig: PinoLoggerOptions = {
    level: config.LOG_LEVEL,
    serializers: {
      req: (req) => {
        // Create a safe headers object that excludes sensitive information
        const safeHeaders: Record<string, any> = {};

        // List of headers to include (safe ones)
        const safeHeaderKeys = [
          'host',
          'user-agent',
          'accept',
          'accept-language',
          'accept-encoding',
          'content-type',
          'content-length',
          'connection',
          'cache-control',
          'origin',
          'referer',
          'sec-fetch-site',
          'sec-fetch-mode',
          'sec-fetch-dest',
        ];

        // Only include safe headers
        if (req.headers) {
          for (const key of safeHeaderKeys) {
            if (req.headers[key]) {
              safeHeaders[key] = req.headers[key];
            }
          }
        }

        // Sanitize URL to remove sensitive query parameters
        const sanitizeUrl = (url: string): string => {
          try {
            const [pathname, queryString] = url.split('?');

            if (!queryString) {
              return url; // No query parameters
            }

            const params = new URLSearchParams(queryString);
            const sensitiveParams = [
              'code', // OAuth authorization code
              'access_token', // Access tokens
              'refresh_token', // Refresh tokens
              'token', // Generic tokens
              'secret', // Secrets
              'key', // API keys
              'password', // Passwords
              'state', // OAuth state (can be sensitive)
              'session_id', // Session identifiers
              'auth', // Auth parameters
              'authorization', // Authorization parameters
            ];

            // Remove sensitive parameters
            sensitiveParams.forEach((param) => {
              if (params.has(param)) {
                params.set(param, '[REDACTED]');
              }
            });

            const sanitizedQuery = params.toString();
            return sanitizedQuery ? `${pathname}?${sanitizedQuery}` : pathname;
          } catch {
            // If URL parsing fails, just return the pathname part
            return url.split('?')[0];
          }
        };

        return {
          method: req.method,
          url: sanitizeUrl(req.url || ''),
          headers: safeHeaders,
          hostname: req.hostname,
          remoteAddress: req.ip,
          remotePort: req.connection?.remotePort,
        };
      },
      res: (res) => ({
        statusCode: res.statusCode,
        headers: res.headers,
      }),
      err: (err) => ({
        type: err.constructor.name,
        message: err.message,
        stack: err.stack,
      }),
    },
  };

  // Determine which transports to use
  const targets: any[] = [];

  // Always include console output with pretty printing in development
  if (isDev) {
    targets.push({
      target: 'pino-pretty',
      level: config.LOG_LEVEL,
      options: {
        colorize: true,
        translateTime: 'HH:MM:ss Z',
        ignore: 'pid,hostname',
      },
    });
  } else {
    // In production, use plain console output
    targets.push({
      target: 'pino/file',
      level: config.LOG_LEVEL,
      options: {
        destination: 1, // stdout
      },
    });
  }

  // Add file logging if enabled
  if (config.ENABLE_FILE_LOGGING) {
    const logFilePath = config.LOG_FILE_PATH || './logs/app.log';
    const logDir = logFilePath.substring(0, logFilePath.lastIndexOf('/'));

    // Create logs directory if it doesn't exist
    if (logDir) {
      try {
        mkdirSync(logDir, { recursive: true });
      } catch (error) {
        console.warn(`Failed to create log directory ${logDir}:`, error);
      }
    }

    targets.push({
      target: 'pino/file',
      level: config.LOG_LEVEL,
      options: {
        destination: logFilePath,
      },
    });
  }

  // Add Loggly transport if enabled and token is available
  if (config.ENABLE_LOGGLY_LOGGING && config.LOGGLY_TOKEN) {
    const logglyTags = config.LOGGLY_TAGS
      ? config.LOGGLY_TAGS.split(',').map((tag) => tag.trim())
      : ['nodejs', 'fastify', 'typescript', config.NODE_ENV];

    targets.push({
      target: resolve(__dirname, './utils/loggly-transport.js'),
      level: config.LOG_LEVEL,
      options: {
        token: config.LOGGLY_TOKEN,
        subdomain: config.LOGGLY_SUBDOMAIN,
        tags: logglyTags,
        batchSize: 25,
        flushInterval: 3000,
      },
    });
  } else if (config.ENABLE_LOGGLY_LOGGING && !config.LOGGLY_TOKEN) {
    console.warn(
      'Loggly logging is enabled but LOGGLY_TOKEN is not provided. Skipping Loggly transport.',
    );
  }

  // Set transport configuration
  if (targets.length === 1) {
    // Single transport - use simplified configuration
    baseConfig.transport = targets[0];
  } else {
    // Multiple transports
    baseConfig.transport = {
      targets,
    };
  }

  return baseConfig;
}

export function buildApp(): FastifyInstance {
  const fastify = Fastify({
    logger: createLoggerConfig(),
    genReqId: () => uuidv4(), // Generate proper UUID-based request IDs
    disableRequestLogging: true, // Disable automatic request/response logging to avoid duplicate reqId
  });

  // --- Register Plugins ---
  // Register request context first for request ID propagation
  fastify.register(import('@fastify/request-context'));

  // Register MongoDB connection first as other services/routes might depend on it
  fastify.register(mongoosePlugin);

  // Register cookie plugin before JWT as we need it for token extraction
  fastify.register(import('@fastify/cookie'));

  // Register CORS plugin to handle preflight requests
  fastify.register(import('@fastify/cors'), {
    origin: isDev
      ? 'http://localhost:3030'
      : config.ALLOWED_ORIGINS
        ? config.ALLOWED_ORIGINS.split(',').map((origin) => origin.trim())
        : [config.FRONTEND_URL], // Fallback to FRONTEND_URL if ALLOWED_ORIGINS is not set
    credentials: true, // Important for cookies with cross-origin requests
    methods: ['GET', 'PUT', 'POST', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
  });

  // Register essential plugins
  fastify.register(jwtPlugin);

  // Register OAuth2 plugin
  fastify.register(oauth2Plugin);

  // Add hook to store request in context for request ID propagation
  fastify.addHook('onRequest', async (request, _reply) => {
    (request as any).requestContext.set('request', request);

    // Create a safe headers object that excludes sensitive information
    const safeHeaders: Record<string, any> = {};

    // List of headers to include (safe ones)
    const safeHeaderKeys = [
      'host',
      'user-agent',
      'accept',
      'accept-language',
      'accept-encoding',
      'content-type',
      'content-length',
      'connection',
      'cache-control',
      'origin',
      'referer',
      'sec-fetch-site',
      'sec-fetch-mode',
      'sec-fetch-dest',
    ];

    // Only include safe headers
    if (request.headers) {
      for (const key of safeHeaderKeys) {
        if (request.headers[key]) {
          safeHeaders[key] = request.headers[key];
        }
      }
    }

    // Sanitize URL to remove sensitive query parameters
    const sanitizeUrl = (url: string): string => {
      try {
        const [pathname, queryString] = url.split('?');

        if (!queryString) {
          return url; // No query parameters
        }

        const params = new URLSearchParams(queryString);
        const sensitiveParams = [
          'code', // OAuth authorization code
          'access_token', // Access tokens
          'refresh_token', // Refresh tokens
          'token', // Generic tokens
          'secret', // Secrets
          'key', // API keys
          'password', // Passwords
          'state', // OAuth state (can be sensitive)
          'session_id', // Session identifiers
          'auth', // Auth parameters
          'authorization', // Authorization parameters
        ];

        // Remove sensitive parameters
        sensitiveParams.forEach((param) => {
          if (params.has(param)) {
            params.set(param, '[REDACTED]');
          }
        });

        const sanitizedQuery = params.toString();
        return sanitizedQuery ? `${pathname}?${sanitizedQuery}` : pathname;
      } catch {
        // If URL parsing fails, just return the pathname part
        return url.split('?')[0];
      }
    };

    // Manual request logging with consistent requestId field
    fastify.log.info(
      {
        requestId: request.id,
        method: request.method,
        url: sanitizeUrl(request.url || ''),
        headers: safeHeaders,
        hostname: request.hostname,
        remoteAddress: request.ip,
      },
      'incoming request',
    );
  });

  // Add response logging hook
  fastify.addHook('onResponse', async (request, reply) => {
    fastify.log.info(
      {
        requestId: request.id,
        statusCode: reply.statusCode,
        responseTime: reply.elapsedTime,
      },
      'request completed',
    );
  });

  // Global authentication middleware with exclusions for public routes
  // NOTE: Commented out to use route-specific authentication instead
  /*
  fastify.addHook('onRequest', async (request, reply) => {
    // Handle root path specifically
    if (request.url === '/') {
      return; // Skip authentication for root path
    }

    // Debug logging
    const matchingRoute = publicRoutes.find((route) => request.url.startsWith(route));
    const isPublicRoute = publicRoutes.some((route) => request.url.startsWith(route));
    
    fastify.log.info(`Global auth hook called for: ${request.url} (${request.method})`);
    fastify.log.info(`Is public route: ${isPublicRoute}, Matching route: ${matchingRoute}`);
    fastify.log.info(`Public routes: ${JSON.stringify(publicRoutes)}`);

    // Skip authentication for public routes
    if (isPublicRoute) {
      fastify.log.info(`Skipping authentication for public route: ${request.url}, matched: ${matchingRoute}`);
      return;
    }

    fastify.log.info(`Applying authentication for protected route: ${request.url}`);

    // Apply authentication for all other routes
    try {
      await authenticate(request, reply);
    } catch (err) {
      fastify.log.warn(
        {
          err,
          url: request.url,
          method: request.method,
        },
        'Authentication failed',
      );
      throw err; // Re-throw to let Fastify handle the error
    }
  });
  */

  // --- Register Routes ---
  // Prefix all auth routes with /api/auth
  fastify.register(authRoutes, { prefix: '/api/auth' });
  // Register course routes
  fastify.register(courseRoutes, { prefix: '/api/courses' });
  // Register video streaming routes
  // fastify.register(videoRoutes);
  // Register hls routes
  fastify.register(hlsRoutes, { prefix: '/api/hls' });
  // Register enrollment module (from enrollment directory)
  fastify.register(enrollmentModule);
  // Register admin user routes
  fastify.register(userRoutes, { prefix: '/api/admin' });
  // Register other routes...
  // fastify.register(userRoutes, { prefix: '/api/users' });

  // --- Basic Root Route ---
  fastify.get('/', async (_request, _reply) => {
    return { message: 'Authentication Service Running' };
  });

  // --- Error Handling (Optional but Recommended) ---
  fastify.setErrorHandler((error, request, reply) => {
    // Convert to AppError if it's not already
    const appError = isAppError(error) ? error : convertToAppError(error);

    // Log the error with appropriate level based on status code
    if (appError.statusCode >= 500) {
      fastify.log.error(
        {
          err: error,
          request: {
            url: request.url,
            method: request.method,
            id: request.id,
          },
        },
        'Server error occurred',
      );
    } else {
      fastify.log.warn(
        {
          err: error,
          request: {
            url: request.url,
            method: request.method,
            id: request.id,
          },
        },
        'Client error occurred',
      );
    }

    // Prepare error response
    const errorResponse = {
      statusCode: appError.statusCode,
      error: appError.errorCode,
      message: appError.message,
    };

    // Add stack trace in non-production environments
    if (config.NODE_ENV !== 'production' && appError.stack) {
      Object.assign(errorResponse, { stack: appError.stack });
    }

    // Send the error response
    reply.status(appError.statusCode).send(errorResponse);
  });

  fastify.log.info('Fastify server initialized');

  return fastify;
}
