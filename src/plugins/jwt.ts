// src/plugins/jwt.ts
import fp from 'fastify-plugin';
import fastifyJwt from '@fastify/jwt';
import { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { config } from '../config'; // Assuming config is loaded and validated

// Define the structure of the JWT payload
export interface UserJWTPayload {
  id: string;
  email: string;
  // Add other relevant, non-sensitive user info if needed
}

// Extend FastifyRequest interface to include the user payload
declare module 'fastify' {
  interface FastifyRequest {
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
      expiresIn: '15m', // Access token expiry (e.g., 15 minutes)
      // Consider adding 'iss' (issuer) and 'aud' (audience) for security
    },
    cookie: {
      cookieName: 'auth_token', // The name of the cookie set in auth.controller.ts
      signed: false, // We're not signing the cookie as we're using httpOnly instead
    },
    // Add verify options if needed
  });

  // Decorator for easy authentication checks on routes
  fastify.decorate(
    'authenticate',
    async function (request: FastifyRequest, reply: FastifyReply): Promise<void> {
      try {
        // First check for token in cookie, then fall back to Authorization header
        await request.jwtVerify();
        // Attach user payload to request for easier access in handlers
        // Note: The type assertion might be needed depending on exact @fastify/jwt setup
        request.jwt = { user: request.user as UserJWTPayload };
      } catch (err) {
        fastify.log.error('Authentication error:', err);
        reply.code(401).send({ message: 'Unauthorized: Invalid or missing token' });
      }
    },
  );
});
