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
  fastify.log.info(
    {
      operation: 'jwt_plugin_initialization',
      jwtSecret: config.JWT_SECRET ? 'configured' : 'missing',
      accessTokenExpiry: config.JWT_ACCESS_TOKEN_EXPIRY,
      cookieSettings: {
        name: 'auth_token',
        signed: false,
      },
    },
    'Initializing JWT plugin',
  );

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

  fastify.log.info(
    {
      operation: 'jwt_plugin_initialization',
      step: 'registered',
    },
    'JWT plugin registered successfully',
  );

  // Decorator for easy authentication checks on routes
  fastify.decorate(
    'authenticate',
    async function (request: FastifyRequest, _reply: FastifyReply): Promise<void> {
      const startTime = Date.now();

      fastify.log.debug(
        {
          operation: 'jwt_authenticate_decorator',
          step: 'started',
          url: request.url,
          method: request.method,
          requestId: request.id,
          userAgent: request.headers['user-agent'],
        },
        'JWT authentication decorator started',
      );

      try {
        // Extract token using shared utility
        fastify.log.debug(
          {
            operation: 'jwt_authenticate_decorator',
            step: 'extracting_token',
            requestId: request.id,
            hasAuthHeader: !!request.headers.authorization,
            hasCookies: Object.keys(request.cookies || {}).length > 0,
          },
          'Extracting JWT token',
        );

        const token = extractToken(request);

        if (!isValidToken(token)) {
          const duration = Date.now() - startTime;

          fastify.log.warn(
            {
              operation: 'jwt_authenticate_decorator',
              step: 'token_missing',
              duration,
              requestId: request.id,
              url: request.url,
              method: request.method,
            },
            'JWT authentication failed: token missing or invalid format',
          );

          throw new AuthenticationError('Authentication token is missing', 'MISSING_TOKEN');
        }

        fastify.log.debug(
          {
            operation: 'jwt_authenticate_decorator',
            step: 'token_extracted',
            requestId: request.id,
          },
          'JWT token extracted successfully',
        );

        // Verify token
        fastify.log.debug(
          {
            operation: 'jwt_authenticate_decorator',
            step: 'verifying_token',
            requestId: request.id,
          },
          'Verifying JWT token',
        );

        const decoded = await fastify.jwt.verify<UserJWTPayload>(token);

        fastify.log.debug(
          {
            operation: 'jwt_authenticate_decorator',
            step: 'token_verified',
            userId: decoded.id,
            email: decoded.email,
            role: decoded.role,
            tokenIat: decoded.iat,
            tokenExp: decoded.exp,
            requestId: request.id,
          },
          'JWT token verified successfully',
        );

        // Validate token payload structure
        if (!decoded.id || !decoded.email || !decoded.role) {
          const duration = Date.now() - startTime;

          fastify.log.warn(
            {
              operation: 'jwt_authenticate_decorator',
              step: 'invalid_payload',
              duration,
              missingFields: [
                !decoded.id && 'id',
                !decoded.email && 'email',
                !decoded.role && 'role',
              ].filter(Boolean),
              providedFields: Object.keys(decoded),
              requestId: request.id,
            },
            'JWT token has invalid payload structure',
          );

          throw new AuthenticationError('Invalid token payload format', 'INVALID_PAYLOAD');
        }

        // Check token expiration
        if (decoded.exp && decoded.exp < Math.floor(Date.now() / 1000)) {
          const duration = Date.now() - startTime;

          fastify.log.warn(
            {
              operation: 'jwt_authenticate_decorator',
              step: 'token_expired',
              duration,
              userId: decoded.id,
              email: decoded.email,
              tokenExp: decoded.exp,
              currentTime: Math.floor(Date.now() / 1000),
              requestId: request.id,
            },
            'JWT token has expired',
          );

          throw new AuthenticationError('Token has expired', 'TOKEN_EXPIRED');
        }

        // Attach user payload to request for easier access in handlers
        request.jwt = { user: decoded };

        // Also set user property for convenience and backward compatibility
        request.user = decoded;

        const duration = Date.now() - startTime;

        fastify.log.info(
          {
            operation: 'jwt_authenticate_decorator',
            step: 'completed',
            success: true,
            duration,
            userId: decoded.id,
            email: decoded.email,
            role: decoded.role,
            requestId: request.id,
            url: request.url,
            method: request.method,
          },
          `JWT authentication successful for user ${decoded.email} in ${duration}ms`,
        );

        // Log business metrics for authentication events
        fastify.log.info(
          {
            metric: 'jwt_authentication_success',
            userId: decoded.id,
            email: decoded.email,
            role: decoded.role,
            url: request.url,
            method: request.method,
            userAgent: request.headers['user-agent'],
            timestamp: new Date().toISOString(),
          },
          'JWT authentication success metric',
        );
      } catch (err) {
        const duration = Date.now() - startTime;

        fastify.log.warn(
          {
            operation: 'jwt_authenticate_decorator',
            step: 'failed',
            duration,
            error: err instanceof Error ? err.message : 'Unknown error',
            errorType: err?.constructor?.name,
            errorCode: (err as any)?.code,
            requestId: request.id,
            url: request.url,
            method: request.method,
            userAgent: request.headers['user-agent'],
          },
          'JWT authentication failed',
        );

        // Log business metrics for authentication failures
        fastify.log.info(
          {
            metric: 'jwt_authentication_failure',
            error: err instanceof Error ? err.message : 'Unknown error',
            errorType: err?.constructor?.name,
            errorCode: (err as any)?.code,
            url: request.url,
            method: request.method,
            userAgent: request.headers['user-agent'],
            clientIP: request.ip,
            timestamp: new Date().toISOString(),
          },
          'JWT authentication failure metric',
        );

        // Throw our custom AuthenticationError that will be caught by the global error handler
        if (err instanceof AuthenticationError) {
          throw err;
        }

        throw new AuthenticationError('Invalid or expired authentication token', 'INVALID_TOKEN');
      }
    },
  );

  fastify.log.info(
    {
      operation: 'jwt_plugin_initialization',
      step: 'completed',
    },
    'JWT plugin initialization completed successfully',
  );
});
