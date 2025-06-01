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
  const startTime = Date.now();

  request.server.log.info(
    {
      operation: 'authenticate_middleware',
      step: 'started',
      url: request.url,
      method: request.method,
      userAgent: request.headers['user-agent'],
      requestId: request.id,
      requireFreshUser: options?.requireFreshUser,
    },
    'Authentication middleware started',
  );

  try {
    // 1. Extract token using shared utility
    request.server.log.debug(
      {
        operation: 'authenticate_middleware',
        step: 'extracting_token',
        hasAuthHeader: !!request.headers.authorization,
        hasCookies: Object.keys(request.cookies || {}).length > 0,
        requestId: request.id,
      },
      'Extracting authentication token',
    );

    const token = extractToken(request);

    if (!isValidToken(token)) {
      const duration = Date.now() - startTime;

      request.server.log.warn(
        {
          operation: 'authenticate_middleware',
          step: 'token_missing',
          duration,
          requestId: request.id,
          url: request.url,
          method: request.method,
        },
        'Authentication failed: token missing or invalid format',
      );

      return reply.status(401).send({
        statusCode: 401,
        error: 'Unauthorized',
        message: 'Authentication token is missing.',
      });
    }

    request.server.log.debug(
      {
        operation: 'authenticate_middleware',
        step: 'token_extracted',
        tokenLength: token.length,
        requestId: request.id,
      },
      'Authentication token extracted successfully',
    );

    // 2. Verify token
    let payload: Record<string, unknown>;
    try {
      request.server.log.debug(
        {
          operation: 'authenticate_middleware',
          step: 'verifying_jwt',
          requestId: request.id,
        },
        'Verifying JWT token',
      );

      payload = await request.server.jwt.verify(token);

      request.server.log.debug(
        {
          operation: 'authenticate_middleware',
          step: 'jwt_verified',
          userId: payload.id,
          email: payload.email,
          role: payload.role,
          requestId: request.id,
        },
        'JWT verification successful',
      );
    } catch (error) {
      const duration = Date.now() - startTime;

      request.server.log.warn(
        {
          operation: 'authenticate_middleware',
          step: 'jwt_verification_failed',
          duration,
          error: error instanceof Error ? error.message : 'Unknown error',
          errorType: error?.constructor?.name,
          requestId: request.id,
          url: request.url,
          method: request.method,
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
      const duration = Date.now() - startTime;

      request.server.log.warn(
        {
          operation: 'authenticate_middleware',
          step: 'payload_validation_failed',
          duration,
          missingFields: [
            !payload.id && 'id',
            !payload.email && 'email',
            !payload.role && 'role',
          ].filter(Boolean),
          providedFields: Object.keys(payload),
          requestId: request.id,
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

    request.server.log.debug(
      {
        operation: 'authenticate_middleware',
        step: 'user_data_created',
        userId: userData.id,
        email: userData.email,
        role: userData.role,
        tokenExp: userData.exp,
        requestId: request.id,
      },
      'User data created from JWT payload',
    );

    // 5. Optional database verification for critical operations
    if (options?.requireFreshUser) {
      request.server.log.info(
        {
          operation: 'authenticate_middleware',
          step: 'fresh_user_check_started',
          userId: userData.id,
          requestId: request.id,
        },
        'Performing fresh user verification from database',
      );

      try {
        const userService = new UserService(request.server);
        const dbUser = await userService.findUserById(userData.id);

        if (!dbUser) {
          const duration = Date.now() - startTime;

          request.server.log.warn(
            {
              operation: 'authenticate_middleware',
              step: 'fresh_user_not_found',
              duration,
              userId: userData.id,
              email: userData.email,
              requestId: request.id,
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

        request.server.log.info(
          {
            operation: 'authenticate_middleware',
            step: 'fresh_user_verified',
            userId: userData.id,
            email: userData.email,
            role: userData.role,
            requestId: request.id,
          },
          'Fresh user verification successful',
        );
      } catch (error) {
        const duration = Date.now() - startTime;

        request.server.log.error(
          {
            operation: 'authenticate_middleware',
            step: 'fresh_user_check_failed',
            duration,
            error: error instanceof Error ? error.message : 'Unknown error',
            errorType: error?.constructor?.name,
            userId: userData.id,
            requestId: request.id,
          },
          'Database verification failed during fresh user check',
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

    const duration = Date.now() - startTime;

    request.server.log.info(
      {
        operation: 'authenticate_middleware',
        step: 'completed',
        success: true,
        duration,
        userId: userData.id,
        email: userData.email,
        role: userData.role,
        freshUserCheck: !!options?.requireFreshUser,
        requestId: request.id,
        url: request.url,
        method: request.method,
      },
      `Authentication successful for user ${userData.email} in ${duration}ms`,
    );
  } catch (error) {
    const duration = Date.now() - startTime;

    request.server.log.error(
      {
        operation: 'authenticate_middleware',
        step: 'unexpected_error',
        success: false,
        duration,
        error: error instanceof Error ? error.message : 'Unknown error',
        errorType: error?.constructor?.name,
        requestId: request.id,
        url: request.url,
        method: request.method,
      },
      'Authentication middleware unexpected error',
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
    const startTime = Date.now();
    const allowedRoles: Role[] = Array.isArray(roles) ? roles : [roles];

    request.server.log.info(
      {
        operation: 'authorize_roles_middleware',
        step: 'started',
        allowedRoles,
        userRole: request.user?.role,
        userId: request.user?.id,
        requestId: request.id,
        url: request.url,
        method: request.method,
      },
      'Role-based authorization started',
    );

    // First ensure user is authenticated
    if (!request.user) {
      const duration = Date.now() - startTime;

      request.server.log.warn(
        {
          operation: 'authorize_roles_middleware',
          step: 'user_not_authenticated',
          duration,
          allowedRoles,
          requestId: request.id,
          url: request.url,
          method: request.method,
        },
        'Authorization failed: user not authenticated',
      );

      return reply.status(401).send({
        statusCode: 401,
        error: 'Unauthorized',
        message: 'Authentication required.',
      });
    }

    // Check if user has any of the allowed roles
    if (!allowedRoles.includes(request.user.role as Role)) {
      const duration = Date.now() - startTime;

      request.server.log.warn(
        {
          operation: 'authorize_roles_middleware',
          step: 'insufficient_permissions',
          duration,
          userId: request.user.id,
          email: request.user.email,
          userRole: request.user.role,
          allowedRoles,
          requestId: request.id,
          url: request.url,
          method: request.method,
        },
        `Authorization failed: user role '${request.user.role}' not in allowed roles [${allowedRoles.join(', ')}]`,
      );

      return reply.status(403).send({
        statusCode: 403,
        error: 'Forbidden',
        message: 'You do not have permission to access this resource.',
      });
    }

    const duration = Date.now() - startTime;

    request.server.log.info(
      {
        operation: 'authorize_roles_middleware',
        step: 'completed',
        success: true,
        duration,
        userId: request.user.id,
        email: request.user.email,
        userRole: request.user.role,
        allowedRoles,
        requestId: request.id,
        url: request.url,
        method: request.method,
      },
      `Authorization successful: user ${request.user.email} has role '${request.user.role}' in ${duration}ms`,
    );
  };
}

// Note: Public routes are now configured in src/config/index.ts
// This allows for environment-specific configuration and better maintainability
