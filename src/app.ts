// src/app.ts
import Fastify, { FastifyInstance } from 'fastify';
import { config, isDev } from './config'; // Load validated config
import { isAppError, convertToAppError } from './utils/errors'; // Import error utilities

// Import plugins
import jwtPlugin from './plugins/jwt';
import oauth2Plugin from './plugins/oauth2';
import mongoosePlugin from './plugins/mongoose'; // MongoDB connection plugin

// Import routes
import authRoutes from './modules/auth/auth.route';
// Import other module routes (e.g., userRoutes) if you have them

export function buildApp(): FastifyInstance {
  const fastify = Fastify({
    logger: {
      level: isDev ? 'info' : 'warn',
      transport: isDev ? { target: 'pino-pretty' } : undefined,
    },
  });

  // --- Register Plugins ---
  // Register MongoDB connection first as other services/routes might depend on it
  fastify.register(mongoosePlugin);

  // Register cookie plugin before JWT as we need it for token extraction
  fastify.register(import('@fastify/cookie'));

  // Register CORS plugin to handle preflight requests
  fastify.register(import('@fastify/cors'), {
    origin: isDev ? 'http://localhost:3030' : config.ALLOWED_ORIGINS?.split(',') || true,
    credentials: true, // Important for cookies with cross-origin requests
    methods: ['GET', 'PUT', 'POST', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
  });

  // Register essential plugins
  fastify.register(jwtPlugin);
  fastify.register(oauth2Plugin);

  // --- Register Routes ---
  // Prefix all auth routes with /api/auth
  fastify.register(authRoutes, { prefix: '/api/auth' });
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
