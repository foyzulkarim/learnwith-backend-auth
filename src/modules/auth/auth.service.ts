// src/modules/auth/auth.service.ts
import { FastifyInstance, FastifyRequest } from 'fastify';
import { UserService } from '../user/user.service'; // Import UserService
import { SessionService } from '../user/session.service'; // Import SessionService
import { UserDocument } from '../user/user.model'; // Import UserDocument type
import { config } from '../../config';
import jwt from 'jsonwebtoken';
import { createServiceLogger } from '../../utils/logger';

interface GoogleProfile {
  id?: string;
  sub?: string;
  email?: string;
  name?: string;
  given_name?: string;
  family_name?: string;
  picture?: string;
  email_verified?: boolean;
}

interface AuthResult {
  user: {
    id: string;
    email: string;
    name: string;
    role: string;
  };
  accessToken: string;
  refreshToken: string;
}

export class AuthService {
  private userService: UserService;
  private sessionService: SessionService;
  private logger = createServiceLogger('AuthService');

  // Inject dependencies (Fastify instance for JWT signing, UserService, SessionService)
  constructor(private fastify: FastifyInstance) {
    this.userService = new UserService(fastify);
    this.sessionService = new SessionService(fastify);
  }

  /**
   * Authenticate user with Google profile and generate tokens
   * @param googleProfile - The Google profile data
   * @param request - Optional request object for better correlation
   * @returns JWT tokens and user info
   */
  async authenticateWithGoogle(
    googleProfile: GoogleProfile,
    request?: FastifyRequest,
  ): Promise<AuthResult> {
    const logMethod = request ? request.log : this.logger;

    logMethod.info(
      {
        hasEmail: !!googleProfile.email,
        hasId: !!(googleProfile.id || googleProfile.sub),
        hasName: !!googleProfile.name,
        ...(request ? {} : { service: 'AuthService' }),
      },
      'Authenticating user with Google profile',
    );

    try {
      // Find or create user
      const user: UserDocument = await this.userService.findOrCreateGoogleUser(
        googleProfile,
        request,
      );

      logMethod.debug('Google profile validated successfully');

      logMethod.info(
        {
          userId: (user._id as any).toString(),
          email: user.email,
          role: user.role,
          isNewUser: !user.googleId,
        },
        'User authentication successful',
      );

      const userId = (user._id as any).toString();

      // Generate access token (short-lived, stateless)
      const accessToken = await this.generateAccessToken(userId, request);

      // Create refresh token session in database (long-lived, stateful)
      const refreshToken = await this.sessionService.createSession(userId, request);

      logMethod.debug(
        {
          userId: userId.substring(0, 8) + '...',
          hasAccessToken: !!accessToken,
          hasRefreshToken: !!refreshToken,
        },
        'Access token and refresh session created successfully',
      );

      return {
        user: {
          id: userId,
          email: user.email,
          name: user.name || user.email,
          role: user.role,
        },
        accessToken,
        refreshToken,
      };
    } catch (error) {
      logMethod.error(
        {
          err: error,
          email: googleProfile.email,
        },
        'Google authentication failed',
      );
      throw error;
    }
  }

  /**
   * Generate JWT access token for a user (short-lived)
   * @param userId - The user ID to generate token for
   * @param request - Optional request object for better correlation
   * @returns JWT access token
   */
  async generateAccessToken(userId: string, request?: FastifyRequest): Promise<string> {
    const logMethod = request ? request.log : this.logger;

    logMethod.debug({ userId: userId.substring(0, 8) + '...' }, 'Generating JWT access token');

    try {
      const payload = {
        userId,
        type: 'access',
        // Include user info in token for fast access without DB lookup
        iat: Math.floor(Date.now() / 1000),
      };
      const secret = config.JWT_SECRET;
      const options: any = { expiresIn: config.JWT_EXPIRES_IN || '1h' };
      const accessToken = jwt.sign(payload, secret, options) as string;

      logMethod.debug(
        {
          userId: userId.substring(0, 8) + '...',
          accessTokenLength: accessToken.length,
          expiresIn: config.JWT_EXPIRES_IN || '1h',
        },
        'Access token generated successfully',
      );

      return accessToken;
    } catch (error) {
      logMethod.error(
        {
          err: error,
          userId: userId.substring(0, 8) + '...',
        },
        'Failed to generate JWT access token',
      );
      throw error;
    }
  }

  /**
   * Verify and decode a JWT token
   * @param token - The JWT token to verify
   * @param tokenType - The type of token ('access' or 'refresh')
   * @param request - Optional request object for better correlation
   * @returns Decoded token payload
   */
  async verifyToken(
    token: string,
    tokenType: 'access' | 'refresh' = 'access',
    request?: FastifyRequest,
  ): Promise<any> {
    const logMethod = request ? request.log : this.logger;

    try {
      const secret = tokenType === 'access' ? config.JWT_SECRET : config.JWT_REFRESH_SECRET;

      const decoded = jwt.verify(token, secret) as any;

      if (decoded.type !== tokenType) {
        throw new Error(`Invalid token type. Expected ${tokenType}, got ${decoded.type}`);
      }

      logMethod.debug(
        {
          userId: decoded.userId?.substring(0, 8) + '...',
          tokenType,
          expiresAt: new Date(decoded.exp * 1000).toISOString(),
        },
        'Token verified successfully',
      );

      return decoded;
    } catch (error) {
      logMethod.error(
        {
          err: error,
          tokenType,
          tokenPreview: token.substring(0, 20) + '...',
        },
        'Token verification failed',
      );
      throw error;
    }
  }

  /**
   * Refresh access token using database-stored refresh token
   * @param refreshToken - The refresh token
   * @param request - Optional request object for better correlation
   * @returns New access token
   */
  async refreshAccessToken(refreshToken: string, request?: FastifyRequest): Promise<string> {
    const logMethod = request ? request.log : this.logger;

    logMethod.debug('Attempting to refresh access token');

    try {
      // Validate refresh token against database
      const userId = await this.sessionService.validateRefreshToken(refreshToken, request);

      // Generate new access token
      const newAccessToken = await this.generateAccessToken(userId, request);

      logMethod.info(
        {
          userId: userId.substring(0, 8) + '...',
          newTokenLength: newAccessToken.length,
        },
        'Access token refreshed successfully',
      );

      return newAccessToken;
    } catch (error) {
      logMethod.error(
        {
          err: error,
          refreshTokenPreview: refreshToken.substring(0, 20) + '...',
        },
        'Token refresh failed',
      );
      throw error;
    }
  }

  /**
   * Get user information from a valid access token
   * @param accessToken - The access token
   * @param request - Optional request object for better correlation
   * @returns User information
   */
  async getUserFromToken(
    accessToken: string,
    request?: FastifyRequest,
  ): Promise<{
    id: string;
    email: string;
    name: string;
    role: string;
  }> {
    const logMethod = request ? request.log : this.logger;

    try {
      // Verify token
      const decoded = await this.verifyToken(accessToken, 'access', request);

      // Get user details
      const user: UserDocument | null = await this.userService.findById(decoded.userId, request);

      if (!user) {
        throw new Error('User not found');
      }

      logMethod.debug(
        {
          userId: (user._id as any).toString(),
          email: user.email,
          role: user.role,
        },
        'User retrieved from token successfully',
      );

      return {
        id: (user._id as any).toString(),
        email: user.email,
        name: user.name || user.email,
        role: user.role,
      };
    } catch (error) {
      logMethod.error(
        {
          err: error,
          tokenPreview: accessToken.substring(0, 20) + '...',
        },
        'Failed to get user from token',
      );
      throw error;
    }
  }

  /**
   * Logout user - revoke refresh token from database
   * @param refreshToken - The refresh token to revoke
   * @param request - Optional request object for better correlation
   */
  async logout(refreshToken: string, request?: FastifyRequest): Promise<void> {
    const logMethod = request ? request.log : this.logger;

    try {
      // Revoke the refresh token in database
      await this.sessionService.revokeRefreshToken(refreshToken, request);

      logMethod.info('User logged out - refresh token revoked');
    } catch (error) {
      logMethod.error(
        {
          err: error,
          refreshTokenPreview: refreshToken.substring(0, 10) + '...',
        },
        'Logout failed',
      );
      throw error;
    }
  }

  /**
   * Logout user from all devices - revoke all refresh tokens
   * @param userId - The user ID logging out from all devices
   * @param request - Optional request object for better correlation
   */
  async logoutAllDevices(userId: string, request?: FastifyRequest): Promise<void> {
    const logMethod = request ? request.log : this.logger;

    try {
      // Revoke all refresh tokens for this user
      await this.sessionService.revokeAllUserSessions(userId, request);

      logMethod.info(
        {
          userId: userId.substring(0, 8) + '...',
        },
        'User logged out from all devices',
      );
    } catch (error) {
      logMethod.error(
        {
          err: error,
          userId: userId.substring(0, 8) + '...',
        },
        'Logout from all devices failed',
      );
      throw error;
    }
  }

  /**
   * Get all active sessions for a user
   * @param userId - The user ID
   * @param request - Optional request object for better correlation
   * @returns Array of active sessions
   */
  async getUserSessions(userId: string, request?: FastifyRequest): Promise<any[]> {
    return await this.sessionService.getUserSessions(userId, request);
  }

  /**
   * Process Google login - wrapper method for backwards compatibility
   * @param googleProfile - The Google profile data
   * @param request - Optional request object for better correlation
   * @returns Access and refresh tokens
   */
  async processGoogleLogin(
    googleProfile: GoogleProfile,
    request?: FastifyRequest,
  ): Promise<{ accessToken: string; refreshToken: string }> {
    const result = await this.authenticateWithGoogle(googleProfile, request);
    return {
      accessToken: result.accessToken,
      refreshToken: result.refreshToken,
    };
  }
}
