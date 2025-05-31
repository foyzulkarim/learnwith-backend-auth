import { FastifyRequest, FastifyReply } from 'fastify';
import { Role } from '../modules/user/types';
import { extractToken, isValidToken } from './tokenUtils';
import { UserService } from '../modules/user/user.service';
import { UserJWTPayload } from '../plugins/jwt';
import { withLogglyTags } from './logglyHelper';
import { getCorrelationContext } from './correlationContext';

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
  const correlationContext = getCorrelationContext(request);

  try {
    // Debug logging with correlation context - using request.log for correlation
    request.log.info(
      {
        url: request.url,
        method: request.method,
        hasAuthHeader: !!request.headers.authorization,
        hasCookies: !!request.cookies?.auth_token,
        ...withLogglyTags(['auth', 'middleware', 'start']),
      },
      'Authentication middleware initiated',
    );

    // 1. Extract token using shared utility
    const token = extractToken(request);

    request.log.info(
      {
        hasToken: !!token,
        ...withLogglyTags(['auth', 'token-extraction']),
      },
      'Token extraction completed',
    );

    if (!isValidToken(token)) {
      request.log.warn(
        {
          reason: 'missing_or_invalid_token',
          sessionId: correlationContext?.sessionId,
          ...withLogglyTags(['auth', 'failure', 'token-validation']),
        },
        'Authentication failed - token validation failed',
      );

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
      request.log.info(
        {
          hasUserId: !!payload.id,
          userRole: payload.role,
          tokenExp: payload.exp,
          ...withLogglyTags(['auth', 'jwt-verification', 'success']),
        },
        'JWT verification successful',
      );
    } catch (error) {
      request.log.error(
        {
          err: error,
          errorType: error instanceof Error ? error.name : 'Unknown',
          sessionId: correlationContext?.sessionId,
          ...withLogglyTags(['auth', 'failure', 'jwt-verification']),
        },
        'JWT verification failed',
      );

      return reply.status(401).send({
        statusCode: 401,
        error: 'Unauthorized',
        message: 'Authentication token is invalid or expired.',
      });
    }

    // 3. Validate token payload
    if (!payload.id || !payload.email || !payload.role) {
      request.log.error(
        {
          hasId: !!payload.id,
          hasEmail: !!payload.email,
          hasRole: !!payload.role,
          sessionId: correlationContext?.sessionId,
          ...withLogglyTags(['auth', 'failure', 'payload-validation']),
        },
        'JWT payload missing required user fields',
      );

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

    request.log.info(
      {
        userId: userData.id.substring(0, 8) + '...', // Partial user ID for tracking
        userRole: userData.role,
        sessionId: correlationContext?.sessionId,
        ...withLogglyTags(['auth', 'user-context', 'created']),
      },
      'User context created from token',
    );

    // 5. Optional database verification for critical operations
    if (options?.requireFreshUser) {
      try {
        const userService = new UserService(request.server);
        const dbUser = await userService.findById(userData.id);

        if (!dbUser) {
          request.log.warn(
            {
              userId: userData.id.substring(0, 8) + '...',
              sessionId: correlationContext?.sessionId,
              ...withLogglyTags(['auth', 'failure', 'user-not-found']),
            },
            'User not found in database during fresh user check',
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

        request.log.info(
          {
            userId: userData.id.substring(0, 8) + '...',
            userRole: userData.role,
            ...withLogglyTags(['auth', 'fresh-user-check', 'success']),
          },
          'Fresh user data retrieved from database',
        );
      } catch (error) {
        request.log.error(
          {
            err: error,
            userId: userData.id.substring(0, 8) + '...',
            sessionId: correlationContext?.sessionId,
            ...withLogglyTags(['auth', 'failure', 'database-verification']),
          },
          'Database verification failed during authentication',
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

    // 7. Enhance correlation context with authenticated user info
    if (request.correlationContext) {
      request.correlationContext.userId = userData.id;
      request.correlationContext.userEmail = userData.email;
      request.correlationContext.userRole = userData.role;
    }

    request.log.info(
      {
        userId: userData.id.substring(0, 8) + '...',
        userRole: userData.role,
        sessionId: correlationContext?.sessionId || request.sessionId,
        ...withLogglyTags(['auth', 'success', 'user-attached']),
      },
      'Authentication successful - user attached to request',
    );
  } catch (error) {
    request.log.error(
      {
        err: error,
        errorType: error instanceof Error ? error.name : 'Unknown',
        sessionId: correlationContext?.sessionId,
        ...withLogglyTags(['auth', 'failure', 'unexpected-error']),
      },
      'Unexpected error in authentication middleware',
    );

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
    const correlationContext = getCorrelationContext(request);

    // First ensure user is authenticated
    if (!request.user) {
      request.log.warn(
        {
          requiredRoles: Array.isArray(roles) ? roles : [roles],
          sessionId: correlationContext?.sessionId,
          ...withLogglyTags(['auth', 'authorization', 'failure', 'not-authenticated']),
        },
        'Authorization failed - user not authenticated',
      );

      return reply.status(401).send({
        statusCode: 401,
        error: 'Unauthorized',
        message: 'Authentication required.',
      });
    }

    // Check if user has any of the allowed roles
    const allowedRoles: Role[] = Array.isArray(roles) ? roles : [roles];
    if (!allowedRoles.includes(request.user.role as Role)) {
      request.log.warn(
        {
          userId: request.user.id.substring(0, 8) + '...',
          userRole: request.user.role,
          requiredRoles: allowedRoles,
          sessionId: correlationContext?.sessionId,
          ...withLogglyTags(['auth', 'authorization', 'failure', 'insufficient-role']),
        },
        'Authorization failed - insufficient role permissions',
      );

      return reply.status(403).send({
        statusCode: 403,
        error: 'Forbidden',
        message: 'You do not have permission to access this resource.',
      });
    }

    request.log.info(
      {
        userId: request.user.id.substring(0, 8) + '...',
        userRole: request.user.role,
        allowedRoles,
        sessionId: correlationContext?.sessionId,
        ...withLogglyTags(['auth', 'authorization', 'success']),
      },
      'Authorization successful - user has required role',
    );
  };
}

// Note: Public routes are now configured in src/config/index.ts
// This allows for environment-specific configuration and better maintainability
