// src/app.ts
import Fastify, { FastifyInstance } from 'fastify';
import { config } from './config'; // Load validated config

// Import plugins
import jwtPlugin from './plugins/jwt';
import oauth2Plugin from './plugins/oauth2';
import prismaPlugin from './plugins/prisma'; // Make sure Prisma plugin is registered first

// Import routes
import authRoutes from './modules/auth/auth.route';
// Import other module routes (e.g., userRoutes) if you have them

export function buildApp(): FastifyInstance {
  const fastify = Fastify({
    logger: {
      level: config.NODE_ENV === 'development' ? 'info' : 'warn',
      transport: config.NODE_ENV === 'development' ? { target: 'pino-pretty' } : undefined,
    },
  });

  // --- Register Plugins ---
  // Register Prisma first as other services/routes might depend on it
  fastify.register(prismaPlugin);

  // Register essential plugins
  fastify.register(jwtPlugin);
  fastify.register(oauth2Plugin);
  // fastify.register(import('@fastify/cookie')); // Uncomment if using cookies for state or token transfer

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
    fastify.log.error(error);
    // Customize error response based on error type or environment
    reply.status(error.statusCode || 500).send({
      message: error.message || 'Internal Server Error',
      // Avoid sending stack trace in production
      ...(config.NODE_ENV !== 'production' && { stack: error.stack }),
    });
  });

  return fastify;
}
