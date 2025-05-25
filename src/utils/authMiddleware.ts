import { FastifyRequest, FastifyReply } from 'fastify';
import { Role } from '../modules/user/types';
import { extractToken, isValidToken } from './tokenUtils';
import { UserService } from '../modules/user/user.service';
import { UserJWTPayload } from '../plugins/jwt';

// Authentication options interface
export interface AuthenticationOptions {
  requireFreshUser?: boolean; // Whether to verify user exists in database
}

// Note: FastifyRequest interface is extended in src/plugins/jwt.ts
// to avoid duplicate declarations and ensure consistency

export const authenticate = async function (
  request: FastifyRequest,
  reply: FastifyReply,
  options?: AuthenticationOptions,
): Promise<void> {
  try {
    // Debug logging
    request.server.log.info('Authentication middleware called for:', {
      url: request.url,
      method: request.method,
      cookies: request.cookies,
      authHeader: request.headers.authorization,
    });

    // 1. Extract token using shared utility
    const token = extractToken(request);

    request.server.log.info('Extracted token:', { token: token ? 'present' : 'missing' });

    if (!isValidToken(token)) {
      request.server.log.warn('Token validation failed');
      return reply.status(401).send({
        statusCode: 401,
        error: 'Unauthorized',
        message: 'Authentication token is missing.',
      });
    }

    // 2. Verify token
    let payload: Record<string, unknown>;
    try {
      payload = await request.server.jwt.verify(token);
      request.server.log.info('JWT verification successful:', { payload });
    } catch (error) {
      request.server.log.error('JWT verification failed:', error);
      return reply.status(401).send({
        statusCode: 401,
        error: 'Unauthorized',
        message: 'Authentication token is invalid or expired.',
      });
    }

    // 3. Validate token payload
    if (!payload.id || !payload.email || !payload.role) {
      request.server.log.error('JWT payload missing required user fields:', payload);
      return reply.status(401).send({
        statusCode: 401,
        error: 'Unauthorized',
        message: 'Authentication token has an invalid format.',
      });
    }

    // 4. Create user data from token payload
    const userData: UserJWTPayload = {
      id: payload.id as string,
      email: payload.email as string,
      role: payload.role as Role,
      iat: payload.iat as number | undefined,
      exp: payload.exp as number | undefined,
    };

    request.server.log.info('Setting user data:', { userData });

    // 5. Optional database verification for critical operations
    if (options?.requireFreshUser) {
      try {
        const userService = new UserService(request.server);
        const dbUser = await userService.findUserById(userData.id);

        if (!dbUser) {
          request.server.log.warn(
            `User ${userData.id} not found in database during fresh user check`,
          );
          return reply.status(401).send({
            statusCode: 401,
            error: 'Unauthorized',
            message: 'User account no longer exists.',
          });
        }

        // Update user data with fresh information from database
        userData.email = dbUser.email;
        userData.role = dbUser.role as Role;
      } catch (error) {
        request.server.log.error(
          { err: error, userId: userData.id },
          'Database verification failed',
        );
        return reply.status(500).send({
          statusCode: 500,
          error: 'Internal Server Error',
          message: 'Authentication verification failed.',
        });
      }
    }

    // 6. Attach user to request with JWT claims
    request.user = userData;

    // Also set jwt.user property for consistency with fastify.authenticate
    if (!request.jwt) {
      request.jwt = { user: userData };
    } else {
      request.jwt.user = userData;
    }

    request.server.log.info('Authentication successful, user attached to request');
  } catch (error) {
    request.server.log.error('Authentication middleware error:', error);
    return reply.status(500).send({
      statusCode: 500,
      error: 'Internal Server Error',
      message: 'An unexpected error occurred.',
    });
  }
};

// Role-based authorization middleware
export function authorizeRoles(
  roles: Role | Role[],
): (request: FastifyRequest, reply: FastifyReply) => Promise<void> {
  return async function (request: FastifyRequest, reply: FastifyReply): Promise<void> {
    // First ensure user is authenticated
    if (!request.user) {
      return reply.status(401).send({
        statusCode: 401,
        error: 'Unauthorized',
        message: 'Authentication required.',
      });
    }

    // Check if user has any of the allowed roles
    const allowedRoles: Role[] = Array.isArray(roles) ? roles : [roles];
    if (!allowedRoles.includes(request.user.role as Role)) {
      return reply.status(403).send({
        statusCode: 403,
        error: 'Forbidden',
        message: 'You do not have permission to access this resource.',
      });
    }
  };
}

// Note: Public routes are now configured in src/config/index.ts
// This allows for environment-specific configuration and better maintainability
