import { FastifyRequest, FastifyReply } from 'fastify';
import { getUserModel } from '../modules/user/user.model';
import { ObjectId } from 'mongodb';
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
  }
}

export const authenticate = async function (
  request: FastifyRequest,
  reply: FastifyReply,
): Promise<void> {
  try {
    // 1. Extract token from Authorization header or cookie
    let token: string | undefined;
    const authHeader = request.headers['authorization'];
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

    // 3. Fetch user from DB
    const UserModel = getUserModel();
    const user = await UserModel.findById(new ObjectId(payload.id)).select('_id email role');

    if (!user) {
      return reply.status(401).send({
        statusCode: 401,
        error: 'Unauthorized',
        message: 'User associated with the token not found.',
      });
    }

    // 4. Attach user to request with additional JWT claims
    request.user = {
      id: user._id.toString(),
      email: user.email,
      role: user.role,
      // Include JWT timestamps if available in payload
      iat: payload.iat,
      exp: payload.exp,
    };
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
