// src/plugins/jwt.ts
import fp from 'fastify-plugin';
import fastifyJwt from '@fastify/jwt';
import { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { config } from '../config'; // Assuming config is loaded and validated
import { AuthenticationError } from '../utils/errors'; // Import our custom error type
import { extractToken, isValidToken } from '../utils/tokenUtils';

import { Role } from '../modules/user/types';

// Define the structure of the JWT payload that extends the base JWT interface
export interface UserJWTPayload {
  id: string;
  email: string;
  role: Role; // Adding role for RBAC
  iat?: number;
  exp?: number;
  [key: string]: unknown; // Index signature for @fastify/jwt compatibility
}

// Extend FastifyRequest interface to include the user payload
declare module 'fastify' {
  interface FastifyRequest {
    user: UserJWTPayload;
    jwt: {
      user: UserJWTPayload;
    };
  }
  interface FastifyInstance {
    authenticate: (request: FastifyRequest, reply: FastifyReply) => Promise<void>;
  }
}

declare module '@fastify/jwt' {
  interface FastifyJWT {
    payload: UserJWTPayload; // Define payload type
    user: UserJWTPayload; // Define user type
  }
}

export default fp(async function jwtPlugin(fastify: FastifyInstance) {
  fastify.register(fastifyJwt, {
    secret: config.JWT_SECRET,
    sign: {
      expiresIn: config.JWT_ACCESS_TOKEN_EXPIRY, // Access token expiry from config
      // Consider adding 'iss' (issuer) and 'aud' (audience) for security
    },
    cookie: {
      cookieName: 'auth_token', // The name of the cookie set in auth.controller.ts
      signed: false, // We're not signing the cookie as we're using httpOnly instead
    },
    decode: { complete: true }, // Include header and signature in decoded value
    // Add verify options if needed
  });

  // Decorator for easy authentication checks on routes
  fastify.decorate(
    'authenticate',
    async function (request: FastifyRequest, _reply: FastifyReply): Promise<void> {
      try {
        // Extract token using shared utility
        const token = extractToken(request);

        if (!isValidToken(token)) {
          throw new AuthenticationError('Authentication token is missing', 'MISSING_TOKEN');
        }

        // Verify token
        const decoded = await fastify.jwt.verify<UserJWTPayload>(token);

        // Attach user payload to request for easier access in handlers
        request.jwt = { user: decoded };

        // Also set user property for convenience and backward compatibility
        request.user = decoded;
      } catch (err) {
        fastify.log.warn({ err, requestId: request.id }, 'Authentication failed');
        // Throw our custom AuthenticationError that will be caught by the global error handler
        throw new AuthenticationError('Invalid or expired authentication token', 'INVALID_TOKEN');
      }
    },
  );
});
