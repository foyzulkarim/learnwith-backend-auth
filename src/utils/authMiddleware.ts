import { FastifyRequest, FastifyReply } from 'fastify';
import { Role } from '../modules/user/types';

// Extend the Fastify type definitions for authenticated requests
declare module 'fastify' {
  interface FastifyRequest {
    // User information attached by the authentication middleware
    user: {
      id: string; // User ID from MongoDB
      email: string; // User email
      role: Role; // User role for authorization checks
      iat?: number; // JWT issued at timestamp
      exp?: number; // JWT expiration timestamp
    };

    // JWT information for consistency with fastify-jwt plugin
    jwt?: {
      user: {
        id: string;
        email: string;
        role: Role;
        iat?: number;
        exp?: number;
      };
    };
  }
}

export const authenticate = async function (
  request: FastifyRequest,
  reply: FastifyReply,
): Promise<void> {
  try {
    // 1. Extract token from Authorization header or cookie
    let token: string | undefined;
    const authHeader = request.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
      token = authHeader.split(' ')[1];
    } else if (request.cookies && request.cookies.auth_token) {
      token = request.cookies.auth_token;
    }

    if (!token) {
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
    } catch (error) {
      request.server.log.error('JWT verification failed:', error);
      return reply.status(401).send({
        statusCode: 401,
        error: 'Unauthorized',
        message: 'Authentication token is invalid or expired.',
      });
    }

    // 3. Use the user data directly from the token payload
    // This eliminates the database query since we already trust the token
    // The payload includes id, email, and role from the generateTokens function
    if (!payload.id || !payload.email || !payload.role) {
      request.server.log.error('JWT payload missing required user fields:', payload);
      return reply.status(401).send({
        statusCode: 401,
        error: 'Unauthorized',
        message: 'Authentication token has an invalid format.',
      });
    }

    // 4. Attach user to request with JWT claims
    const userData = {
      id: payload.id as string,
      email: payload.email as string,
      role: payload.role as Role,
      // Include JWT timestamps if available in payload
      iat: payload.iat,
      exp: payload.exp,
    };

    // Set both user properties for consistency with the jwt plugin decorator
    request.user = userData;

    // Also set jwt.user property for consistency with fastify.authenticate
    if (!request.jwt) {
      request.jwt = { user: userData };
    } else {
      request.jwt.user = userData;
    }
  } catch (error) {
    request.server.log.error(error);
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
    const allowedRoles = Array.isArray(roles) ? roles : [roles];
    if (!allowedRoles.includes(request.user.role)) {
      return reply.status(403).send({
        statusCode: 403,
        error: 'Forbidden',
        message: 'You do not have permission to access this resource.',
      });
    }
  };
}

// Public routes that don't require authentication
export const publicRoutes = [
  '/api/auth/login',
  '/api/auth/register',
  '/api/auth/google',
  '/api/auth/google/callback',
  '/api/auth/refresh',
  '/', // Root path for health check
];
