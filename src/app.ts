// src/app.ts
import Fastify, { FastifyInstance } from 'fastify';
import { nanoid } from 'nanoid'; // Import nanoid for request IDs
import { config, isDev } from './config'; // Load validated config
import { isAppError, convertToAppError } from './utils/errors'; // Import error utilities
import { logger } from './utils/logger'; // Import centralized logger
import { logSystemInfo } from './utils/logglyHelper'; // Import Loggly helpers
import { registerRequestContextMiddleware } from './utils/requestContextMiddleware'; // Request context middleware
import { registerLogglyHealthRoutes } from './utils/logglyHealth'; // Loggly health check

// Import plugins
import jwtPlugin from './plugins/jwt';
import oauth2Plugin from './plugins/oauth2';
import mongoosePlugin from './plugins/mongoose'; // MongoDB connection plugin

// Import routes
import authRoutes from './modules/auth/auth.route';
import courseRoutes from './modules/course/course.route';
// import videoRoutes from './modules/course/video.route';
import hlsRoutes from './modules/course/hls.route';
// Import other module routes (e.g., userRoutes) if you have them

export function buildApp(): FastifyInstance {
  // Use the centralized logger instance that supports Loggly
  const fastify = Fastify({
    logger,
    // Generate request IDs for better tracing in logs
    genReqId: () => nanoid(10)
  });

  // Register request context middleware early to ensure all requests are properly traced
  registerRequestContextMiddleware(fastify);

  // --- Register Plugins ---
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
  // Register other routes...
  // fastify.register(userRoutes, { prefix: '/api/users' });

  // --- Basic Root Route ---
  fastify.get('/', async (_request, _reply) => {
    return { message: 'Authentication Service Running' };
  });
  
  // Register health check routes
  fastify.get('/api/health', async (_request, reply) => {
    return reply.send({ status: 'ok', timestamp: new Date().toISOString() });
  });
  
  // Register Loggly-specific health check
  registerLogglyHealthRoutes(fastify);

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
  
  // Log system information with Loggly integration if configured
  logSystemInfo(fastify);

  return fastify;
}
