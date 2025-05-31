import { FastifyInstance, FastifyRequest } from 'fastify';
import { getSessionModel } from './session.model';
import { createServiceLogger } from '../../utils/logger';
import { nanoid } from 'nanoid';

export class SessionService {
  private sessionModel;
  private logger = createServiceLogger('SessionService');

  constructor(private fastify: FastifyInstance) {
    this.sessionModel = getSessionModel();
  }

  /**
   * Create a new refresh token session in the database
   * @param userId - The user ID
   * @param request - Request object for device info
   * @returns Refresh token string
   */
  async createSession(userId: string, request?: FastifyRequest): Promise<string> {
    const logMethod = request ? request.log : this.logger;

    try {
      // Generate a secure refresh token
      const refreshToken = nanoid(64); // 64-character random string

      // Calculate expiration (7 days from now)
      const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

      // Gather device/request info
      const deviceInfo = request
        ? {
            ipAddress: request.ip,
            userAgent: request.headers['user-agent'] || 'Unknown',
            deviceInfo: this.extractDeviceInfo(request.headers['user-agent']),
          }
        : {};

      // Create session in database
      const session = await this.sessionModel.create({
        userId,
        refreshToken,
        expiresAt,
        ...deviceInfo,
      });

      // Set session ID on request for correlation tracking
      if (request) {
        request.sessionId = session._id.toString();
      }

      logMethod.info(
        {
          userId: userId.substring(0, 8) + '...',
          sessionId: session._id.toString(),
          expiresAt: expiresAt.toISOString(),
          hasDeviceInfo: !!deviceInfo.deviceInfo,
        },
        'Refresh token session created',
      );

      return refreshToken;
    } catch (error) {
      logMethod.error(
        {
          err: error,
          userId: userId.substring(0, 8) + '...',
        },
        'Failed to create refresh token session',
      );
      throw error;
    }
  }

  /**
   * Validate a refresh token and return the user ID
   * @param refreshToken - The refresh token to validate
   * @param request - Optional request object for logging
   * @returns User ID if valid
   */
  async validateRefreshToken(refreshToken: string, request?: FastifyRequest): Promise<string> {
    const logMethod = request ? request.log : this.logger;

    try {
      const session = await this.sessionModel.findOne({
        refreshToken,
        isActive: true,
        expiresAt: { $gt: new Date() },
      });

      if (!session) {
        logMethod.warn(
          {
            refreshTokenPreview: refreshToken.substring(0, 10) + '...',
          },
          'Invalid or expired refresh token',
        );
        throw new Error('Invalid or expired refresh token');
      }

      // Update last used timestamp
      session.lastUsedAt = new Date();
      await session.save();

      // Set session ID on request for correlation tracking
      if (request) {
        request.sessionId = session._id.toString();
      }

      logMethod.info(
        {
          userId: session.userId.toString().substring(0, 8) + '...',
          sessionId: session._id.toString(),
          lastUsed: session.lastUsedAt.toISOString(),
        },
        'Refresh token validated successfully',
      );

      return session.userId.toString();
    } catch (error) {
      logMethod.error(
        {
          err: error,
          refreshTokenPreview: refreshToken.substring(0, 10) + '...',
        },
        'Refresh token validation failed',
      );
      throw error;
    }
  }

  /**
   * Revoke a specific refresh token
   * @param refreshToken - The refresh token to revoke
   * @param request - Optional request object for logging
   */
  async revokeRefreshToken(refreshToken: string, request?: FastifyRequest): Promise<void> {
    const logMethod = request ? request.log : this.logger;

    try {
      const result = await this.sessionModel.updateOne({ refreshToken }, { isActive: false });

      if (result.modifiedCount === 0) {
        logMethod.warn(
          {
            refreshTokenPreview: refreshToken.substring(0, 10) + '...',
          },
          'Refresh token not found for revocation',
        );
        return;
      }

      logMethod.info(
        {
          refreshTokenPreview: refreshToken.substring(0, 10) + '...',
        },
        'Refresh token revoked successfully',
      );
    } catch (error) {
      logMethod.error(
        {
          err: error,
          refreshTokenPreview: refreshToken.substring(0, 10) + '...',
        },
        'Failed to revoke refresh token',
      );
      throw error;
    }
  }

  /**
   * Revoke all refresh tokens for a user (logout from all devices)
   * @param userId - The user ID
   * @param request - Optional request object for logging
   */
  async revokeAllUserSessions(userId: string, request?: FastifyRequest): Promise<void> {
    const logMethod = request ? request.log : this.logger;

    try {
      const result = await this.sessionModel.updateMany(
        { userId, isActive: true },
        { isActive: false },
      );

      logMethod.info(
        {
          userId: userId.substring(0, 8) + '...',
          revokedCount: result.modifiedCount,
        },
        'All user sessions revoked',
      );
    } catch (error) {
      logMethod.error(
        {
          err: error,
          userId: userId.substring(0, 8) + '...',
        },
        'Failed to revoke all user sessions',
      );
      throw error;
    }
  }

  /**
   * Get all active sessions for a user
   * @param userId - The user ID
   * @param request - Optional request object for logging
   * @returns Array of active sessions
   */
  async getUserSessions(userId: string, request?: FastifyRequest): Promise<any[]> {
    const logMethod = request ? request.log : this.logger;

    try {
      const sessions = await this.sessionModel
        .find({
          userId,
          isActive: true,
          expiresAt: { $gt: new Date() },
        })
        .select('deviceInfo ipAddress userAgent createdAt lastUsedAt')
        .lean();

      logMethod.debug(
        {
          userId: userId.substring(0, 8) + '...',
          activeSessionCount: sessions.length,
        },
        'Retrieved user sessions',
      );

      return sessions.map((session) => ({
        id: session._id,
        deviceInfo: session.deviceInfo,
        ipAddress: session.ipAddress,
        userAgent: session.userAgent,
        createdAt: session.createdAt,
        lastUsedAt: session.lastUsedAt,
      }));
    } catch (error) {
      logMethod.error(
        {
          err: error,
          userId: userId.substring(0, 8) + '...',
        },
        'Failed to retrieve user sessions',
      );
      throw error;
    }
  }

  /**
   * Clean up expired sessions (called periodically)
   */
  async cleanupExpiredSessions(): Promise<void> {
    try {
      const result = await this.sessionModel.deleteMany({
        $or: [
          { expiresAt: { $lt: new Date() } },
          { isActive: false, updatedAt: { $lt: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) } }, // Remove inactive sessions older than 30 days
        ],
      });

      this.logger.info(
        {
          deletedCount: result.deletedCount,
        },
        'Cleaned up expired sessions',
      );
    } catch (error) {
      this.logger.error(
        {
          err: error,
        },
        'Failed to cleanup expired sessions',
      );
    }
  }

  /**
   * Get session information by refresh token (for correlation context)
   * @param refreshToken - The refresh token
   * @param request - Optional request object for logging
   * @returns Session information
   */
  async getSessionByRefreshToken(
    refreshToken: string,
    request?: FastifyRequest,
  ): Promise<{
    sessionId: string;
    userId: string;
    deviceInfo?: string;
    ipAddress?: string;
    createdAt: Date;
    lastUsedAt: Date;
  } | null> {
    const logMethod = request ? request.log : this.logger;

    try {
      const session = await this.sessionModel
        .findOne({
          refreshToken,
          isActive: true,
          expiresAt: { $gt: new Date() },
        })
        .select('userId deviceInfo ipAddress createdAt lastUsedAt')
        .lean();

      if (!session) {
        return null;
      }

      return {
        sessionId: session._id.toString(),
        userId: session.userId.toString(),
        deviceInfo: session.deviceInfo,
        ipAddress: session.ipAddress,
        createdAt: session.createdAt,
        lastUsedAt: session.lastUsedAt,
      };
    } catch (error) {
      logMethod.error(
        {
          err: error,
          refreshTokenPreview: refreshToken.substring(0, 10) + '...',
        },
        'Failed to get session by refresh token',
      );
      return null;
    }
  }

  /**
   * Extract device information from user agent
   * @param userAgent - User agent string
   * @returns Device info string
   */
  private extractDeviceInfo(userAgent?: string): string {
    if (!userAgent) return 'Unknown Device';

    // Simple device detection (you could use a library like 'ua-parser-js' for better detection)
    if (userAgent.includes('Mobile')) return 'Mobile Device';
    if (userAgent.includes('Tablet')) return 'Tablet';
    if (userAgent.includes('iPhone')) return 'iPhone';
    if (userAgent.includes('Android')) return 'Android Device';
    if (userAgent.includes('iPad')) return 'iPad';
    if (userAgent.includes('Mac')) return 'Mac';
    if (userAgent.includes('Windows')) return 'Windows PC';
    if (userAgent.includes('Linux')) return 'Linux PC';

    return 'Unknown Device';
  }
}
