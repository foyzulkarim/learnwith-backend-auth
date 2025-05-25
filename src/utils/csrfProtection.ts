import { FastifyRequest, FastifyReply } from 'fastify';
import { AppError } from './errors';
import { createHash, randomBytes } from 'crypto';

const CSRF_TOKEN_HEADER = 'x-csrf-token';
const CSRF_COOKIE_NAME = 'csrf-token';

/**
 * Generate a CSRF token
 */
function generateCSRFToken(): string {
  return randomBytes(32).toString('hex');
}

/**
 * Create CSRF token hash for validation
 */
function createTokenHash(token: string, secret: string): string {
  return createHash('sha256')
    .update(token + secret)
    .digest('hex');
}

/**
 * CSRF protection middleware
 * Note: This is a simplified implementation. For production, consider using
 * a more robust CSRF protection library like @fastify/csrf-protection
 */
export function csrfProtection(secret: string) {
  return async (request: FastifyRequest, _reply: FastifyReply): Promise<void> => {
    const method = request.method.toLowerCase();

    // Skip CSRF protection for safe HTTP methods
    if (['get', 'head', 'options'].includes(method)) {
      return;
    }

    // Skip for same-site requests with proper SameSite cookie setting
    // This is a simplified check - in production, you might want more robust validation
    const origin = request.headers.origin;
    const host = request.headers.host;
    const referer = request.headers.referer;

    // Allow requests from same origin
    if (origin && host && origin.includes(host)) {
      return;
    }

    if (referer && host && referer.includes(host)) {
      return;
    }

    // For API endpoints with proper CORS and SameSite cookies, CSRF protection
    // is often not necessary, especially when using JWT tokens in httpOnly cookies
    // This is more of a defense-in-depth measure

    const csrfToken = request.headers[CSRF_TOKEN_HEADER] as string;
    const csrfCookie = request.cookies[CSRF_COOKIE_NAME];

    if (!csrfToken || !csrfCookie) {
      throw new AppError('CSRF token missing', 403, 'CSRF_TOKEN_MISSING');
    }

    // Validate CSRF token
    const expectedHash = createTokenHash(csrfCookie, secret);
    const providedHash = createTokenHash(csrfToken, secret);

    if (expectedHash !== providedHash) {
      throw new AppError('Invalid CSRF token', 403, 'CSRF_TOKEN_INVALID');
    }
  };
}

/**
 * Set CSRF token cookie
 */
export function setCSRFToken(reply: FastifyReply): string {
  const token = generateCSRFToken();

  reply.setCookie(CSRF_COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    maxAge: 24 * 60 * 60 * 1000, // 24 hours
  });

  return token;
}

/**
 * Get CSRF token endpoint handler
 */
export async function getCSRFToken(request: FastifyRequest, reply: FastifyReply) {
  const token = setCSRFToken(reply);

  return {
    csrfToken: token,
  };
}
