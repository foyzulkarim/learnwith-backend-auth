import { FastifyRequest, FastifyReply } from 'fastify';
import { nanoid } from 'nanoid';

/**
 * Session management utility for correlation tracking
 */

const SESSION_COOKIE_NAME = 'session_id';
const SESSION_EXPIRY_DAYS = 30; // 30 days

/**
 * Get or create a session ID for the request
 */
export function getOrCreateSessionId(request: FastifyRequest, reply: FastifyReply): string {
  // Try to get existing session ID from cookie
  let sessionId = request.cookies?.[SESSION_COOKIE_NAME];

  if (!sessionId) {
    // Generate new session ID
    sessionId = nanoid(16);

    // Set session cookie
    reply.setCookie(SESSION_COOKIE_NAME, sessionId, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: SESSION_EXPIRY_DAYS * 24 * 60 * 60 * 1000, // 30 days in milliseconds
      path: '/',
    });
  }

  return sessionId;
}

/**
 * Clear session ID from cookies
 */
export function clearSessionId(reply: FastifyReply): void {
  reply.clearCookie(SESSION_COOKIE_NAME, {
    path: '/',
  });
}

/**
 * Refresh session expiry
 */
export function refreshSession(request: FastifyRequest, reply: FastifyReply): void {
  const sessionId = request.cookies?.[SESSION_COOKIE_NAME];

  if (sessionId) {
    reply.setCookie(SESSION_COOKIE_NAME, sessionId, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: SESSION_EXPIRY_DAYS * 24 * 60 * 60 * 1000,
      path: '/',
    });
  }
}
