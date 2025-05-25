import { FastifyRequest } from 'fastify';

/**
 * Extracts JWT token from request headers or cookies
 * @param request - Fastify request object
 * @returns JWT token string or undefined if not found
 */
export function extractToken(request: FastifyRequest): string | undefined {
  // First check Authorization header (Bearer token)
  const authHeader = request.headers.authorization;
  if (authHeader?.startsWith('Bearer ')) {
    return authHeader.split(' ')[1];
  }

  // Fall back to cookie-based token
  return request.cookies?.auth_token;
}

/**
 * Validates that a token exists and is not empty
 * @param token - Token string to validate
 * @returns True if token is valid, false otherwise
 */
export function isValidToken(token: string | undefined): token is string {
  return typeof token === 'string' && token.trim().length > 0;
}
