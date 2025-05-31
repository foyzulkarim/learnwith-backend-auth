import { FastifyRequest } from 'fastify';
import { nanoid } from 'nanoid';
import { UserJWTPayload } from '../plugins/jwt';

/**
 * Context information that will be attached to all logs within a request
 */
export interface CorrelationContext {
  correlationId: string;
  requestId: string;
  sessionId?: string;
  userId?: string;
  userEmail?: string;
  userRole?: string;
  userAgent?: string;
  ip?: string;
  method?: string;
  url?: string;
  startTime: number;
}

/**
 * Extract session ID from various sources (database sessions, headers, etc.)
 */
function extractSessionId(request: FastifyRequest): string | undefined {
  // 1. First priority: Database session ID attached during authentication
  // This is set by our session service when validating refresh tokens
  if (request.sessionId) {
    return request.sessionId;
  }

  // 2. Try to extract from refresh token header (if provided for token refresh)
  const refreshTokenHeader = request.headers['x-refresh-token'] as string;
  if (refreshTokenHeader) {
    // Use first 8 characters of refresh token as session identifier
    // This gives us session correlation without exposing the actual token
    return `rt_${refreshTokenHeader.substring(0, 8)}`;
  }

  // 3. Check request body for refresh token (during token refresh endpoint)
  const body = request.body as any;
  if (body?.refreshToken) {
    return `rt_${body.refreshToken.substring(0, 8)}`;
  }

  // 4. Generate a temporary session ID based on user agent + IP (last resort)
  const userAgent = request.headers['user-agent'];
  const ip = request.ip;
  if (userAgent && ip) {
    // Create a simple hash for session tracking
    const sessionString = `${userAgent.substring(0, 20)}_${ip}`;
    return `temp_${hashString(sessionString).toString(36).substring(0, 8)}`;
  }

  return undefined;
}

/**
 * Simple hash function for generating consistent identifiers
 */
function hashString(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash = hash & hash; // Convert to 32bit integer
  }
  return Math.abs(hash);
}

/**
 * Extract user context from authenticated request
 */
function extractUserContext(request: FastifyRequest): {
  userId?: string;
  userEmail?: string;
  userRole?: string;
} {
  const user = request.user as UserJWTPayload | undefined;

  if (!user) {
    return {};
  }

  return {
    userId: user.id,
    userEmail: user.email,
    userRole: user.role,
  };
}

/**
 * Create correlation context for a request
 */
export function createCorrelationContext(request: FastifyRequest): CorrelationContext {
  const correlationId = nanoid(12); // Shorter than request ID for easier reading
  const sessionId = extractSessionId(request);
  const userContext = extractUserContext(request);

  return {
    correlationId,
    requestId: request.id || nanoid(10),
    sessionId,
    ...userContext,
    userAgent: request.headers['user-agent'],
    ip: request.ip,
    method: request.method,
    url: request.url,
    startTime: Date.now(),
  };
}

/**
 * Create a safe log context that excludes sensitive information
 */
export function createLogContext(context: CorrelationContext): Record<string, unknown> {
  return {
    correlationId: context.correlationId,
    requestId: context.requestId,
    sessionId: context.sessionId,
    userId: context.userId ? maskUserId(context.userId) : undefined,
    userEmail: context.userEmail ? maskEmail(context.userEmail) : undefined,
    userRole: context.userRole,
    userAgent: context.userAgent ? context.userAgent.substring(0, 100) : undefined, // Truncate long user agents
    ip: context.ip,
    method: context.method,
    url: context.url,
  };
}

/**
 * Mask user ID for privacy while keeping it trackable
 */
function maskUserId(userId: string): string {
  if (userId.length <= 8) {
    return '***masked***';
  }
  return `${userId.substring(0, 4)}...${userId.substring(userId.length - 4)}`;
}

/**
 * Mask email for privacy while keeping domain visible
 */
function maskEmail(email: string): string {
  const [localPart, domain] = email.split('@');
  if (!domain) {
    return '***@masked.com';
  }

  const maskedLocal = localPart.length > 2 ? `${localPart.substring(0, 2)}***` : '***';

  return `${maskedLocal}@${domain}`;
}

/**
 * Type guard to check if request has correlation context
 */
export function hasCorrelationContext(
  request: FastifyRequest,
): request is FastifyRequest & { correlationContext: CorrelationContext } {
  return 'correlationContext' in request && request.correlationContext !== undefined;
}

/**
 * Get correlation context from request, with fallback
 */
export function getCorrelationContext(request: FastifyRequest): CorrelationContext | null {
  if (hasCorrelationContext(request)) {
    return request.correlationContext;
  }
  return null;
}

/**
 * Get a user-friendly correlation summary for external use (support tickets, etc.)
 */
export function getCorrelationSummary(request: FastifyRequest): {
  correlationId: string;
  sessionId?: string;
  userId?: string;
  timestamp: string;
} | null {
  const context = getCorrelationContext(request);
  if (!context) {
    return null;
  }

  return {
    correlationId: context.correlationId,
    sessionId: context.sessionId,
    userId: context.userId ? maskUserId(context.userId) : undefined,
    timestamp: new Date(context.startTime).toISOString(),
  };
}
