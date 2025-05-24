// src/plugins/jwt.ts
import fp from 'fastify-plugin';
import fastifyJwt from '@fastify/jwt';
import { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { config } from '../config'; // Assuming config is loaded and validated
import { AuthenticationError, NotFoundError } from '../utils/errors'; // Import our custom error types
import { UserService } from '../modules/user/user.service'; // Import UserService
import { User } from '../modules/user/types'; // Import User type

// Define the structure of the JWT payload
export interface UserJWTPayload {
  id: string;
  email: string;
  role: string; // Adding role for RBAC
  // Add other relevant, non-sensitive user info if needed
}

// Extend FastifyRequest interface to include the user payload
declare module 'fastify' {
  interface FastifyRequest {
    user: UserJWTPayload; // Changed from request.jwt.user to request.user
  }
  interface FastifyInstance {
    authenticate: (request: FastifyRequest, reply: FastifyReply) => Promise<void>;
  }
}

declare module '@fastify/jwt' {
  interface FastifyJWT {
    payload: UserJWTPayload; // Define payload type
    user: UserJWTPayload; // Define user type - this is populated by @fastify/jwt after verify
  }
}

export default fp(async function jwtPlugin(fastify: FastifyInstance) {
  const userService = new UserService(fastify); // Instantiate UserService

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
    // Add verify options if needed
  });

  // Decorator for easy authentication checks on routes
  fastify.decorate(
    'authenticate',
    async function (request: FastifyRequest, reply: FastifyReply): Promise<void> {
      try {
        await request.jwtVerify(); // Verifies token from cookie or header

        // request.user is populated by jwtVerify with token payload at this point
        const tokenPayload = request.user as UserJWTPayload; 

        if (!tokenPayload || !tokenPayload.id) {
          // This case should ideally be caught by jwtVerify if the token is malformed
          throw new AuthenticationError('Invalid token payload.', 'Unauthorized');
        }

        const userFromDb: User | null = await userService.findUserById(tokenPayload.id);

        if (!userFromDb) {
          throw new AuthenticationError(
            'User associated with the token not found.',
            'Unauthorized',
          );
        }

        // Replace token payload (request.user) with fresh user data from DB,
        // conforming to UserJWTPayload structure.
        // Note: @fastify/jwt populates request.user. We are overwriting it here.
        request.user = {
          id: userFromDb.id, // id is already a string in our User type
          email: userFromDb.email,
          role: userFromDb.role,
        };
        
        // The line `request.jwt = { user: request.user as UserJWTPayload };` is no longer needed
        // as we are directly using request.user.

      } catch (err: any) {
        fastify.log.warn({ err, requestId: request.id }, 'Authentication failed in decorator');
        if (err instanceof AuthenticationError) {
          throw err; // Re-throw known authentication errors that we've already customized
        }
        
        // Handle JWT specific errors from request.jwtVerify()
        if (err.code === 'FST_JWT_NO_AUTHORIZATION_IN_COOKIE' || err.code === 'FST_JWT_NO_AUTHORIZATION_IN_HEADER') {
          throw new AuthenticationError('Authentication token is missing.', 'Unauthorized');
        } else if (err.name === 'FastifyError' && err.code && err.code.startsWith('FST_JWT_')) {
          // Catches other @fastify/jwt errors (e.g., FST_JWT_INVALID_TOKEN, FST_JWT_BAD_REQUEST, etc.)
          throw new AuthenticationError('Authentication token is invalid or expired.', 'Unauthorized');
        }

        // Fallback for other unexpected errors during the authentication process
        throw new AuthenticationError(
          err.message || 'An unexpected error occurred during authentication.',
          'Unauthorized' 
        );
      }
    },
  );
}, {
  name: 'fastify-jwt'
  // No other dependencies are explicitly defined for this plugin itself,
  // though it registers @fastify/jwt which has its own dependencies handled by npm.
});
