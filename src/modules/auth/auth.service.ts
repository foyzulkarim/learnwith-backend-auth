// src/modules/auth/auth.service.ts
import { FastifyInstance } from 'fastify';
import { UserService, GoogleUserProfile } from '../user/user.service'; // Import UserService
import { UserJWTPayload } from '../../plugins/jwt'; // Import JWT payload type
import { User } from '../user/types';
import {
  AuthenticationError,
  ValidationError,
  NotFoundError,
  ExternalServiceError,
} from '../../utils/errors';
import { config } from '../../config';
import { createLogger, Logger } from '../../utils/logger';

export class AuthService {
  private logger: Logger;

  // Inject dependencies (Fastify instance for JWT signing, UserService)
  constructor(
    private fastify: FastifyInstance,
    private userService: UserService,
  ) {
    this.logger = createLogger(fastify);
  }

  /**
   * Processes Google user profile, finds/creates user, and generates JWT.
   * @param googleProfile - User profile data from Google.
   * @returns The generated JWTs (accessToken and refreshToken).
   */
  async processGoogleLogin(
    googleProfile: GoogleUserProfile,
  ): Promise<{ accessToken: string; refreshToken: string }> {
    const logContext = this.logger.startOperation('AuthService.processGoogleLogin', {
      googleId: googleProfile.sub || googleProfile.id,
      email: googleProfile.email,
      hasName: !!googleProfile.name,
    });

    try {
      // Validate Google profile has all required fields
      this.validateGoogleProfile(googleProfile);

      this.logger.info(
        {
          operation: 'AuthService.processGoogleLogin',
          step: 'profile_validated',
          googleId: googleProfile.sub || googleProfile.id,
          email: googleProfile.email,
        },
        'Google profile validation successful',
      );

      // Find or create user in the database using the original Google profile
      const user = await this.userService.findOrCreateUserByGoogleProfile(googleProfile);

      this.logger.info(
        {
          operation: 'AuthService.processGoogleLogin',
          step: 'user_resolved',
          userId: user.id,
          email: user.email,
          role: user.role,
        },
        `User resolved: ${user.email}`,
      );

      // Generate tokens for the user
      const tokens = await this.generateTokens(user);

      // Success logging with business metrics
      this.logger.endOperation(
        logContext,
        `Successfully processed Google login for user: ${user.email}`,
        {
          userId: user.id,
          email: user.email,
          role: user.role,
          tokenGenerated: true,
        },
      );

      // Log business metrics
      this.logger.logMetric(
        'google_login_success',
        {
          userId: user.id,
          email: user.email,
          role: user.role,
          googleId: googleProfile.sub || googleProfile.id,
        },
        'Successful Google login',
      );

      return tokens;
    } catch (error) {
      this.logger.errorOperation(logContext, error, 'Google login processing failed', {
        googleId: googleProfile.sub || googleProfile.id,
        email: googleProfile.email,
      });

      // If it's already one of our custom errors, rethrow it
      if (
        error instanceof ValidationError ||
        error instanceof NotFoundError ||
        error instanceof AuthenticationError
      ) {
        throw error;
      }

      // Otherwise wrap in an appropriate custom error
      if (error instanceof Error) {
        throw new ExternalServiceError(
          `Google login processing failed: ${error.message}`,
          'GOOGLE_AUTH_ERROR',
        );
      }

      throw new ExternalServiceError(
        'An unexpected error occurred during Google login.',
        'GOOGLE_AUTH_UNKNOWN_ERROR',
      );
    }
  }

  /**
   * Validates that a Google profile contains all required fields
   * @param profile - The Google profile to validate
   * @throws ValidationError if any required fields are missing
   */
  private validateGoogleProfile(profile: GoogleUserProfile): void {
    const logContext = this.logger.startOperation('AuthService.validateGoogleProfile', {
      hasGoogleId: !!(profile.sub || profile.id),
      hasEmail: !!profile.email,
      emailVerified: profile.email_verified,
    });

    try {
      const requiredFields = ['sub', 'email'];
      const missingFields = requiredFields.filter(
        (field) => !profile[field as keyof GoogleUserProfile],
      );

      if (missingFields.length > 0) {
        this.logger.warn(
          {
            operation: 'AuthService.validateGoogleProfile',
            missingFields,
            providedFields: Object.keys(profile).filter(
              (key) => !!profile[key as keyof GoogleUserProfile],
            ),
          },
          `Google profile validation failed: missing ${missingFields.join(', ')}`,
        );

        throw new ValidationError(
          `Google profile missing required fields: ${missingFields.join(', ')}`,
          'GOOGLE_PROFILE_INVALID',
        );
      }

      // Ensure the email is verified (Google should ensure this, but double-check)
      if (profile.email_verified === false) {
        this.logger.warn(
          {
            operation: 'AuthService.validateGoogleProfile',
            email: profile.email,
            emailVerified: profile.email_verified,
          },
          'Google email verification failed',
        );

        throw new ValidationError('Google email is not verified', 'GOOGLE_EMAIL_UNVERIFIED');
      }

      this.logger.endOperation(logContext, 'Google profile validation successful', {
        googleId: profile.sub || profile.id,
        email: profile.email,
        emailVerified: profile.email_verified,
      });
    } catch (error) {
      this.logger.errorOperation(logContext, error, 'Google profile validation failed');
      throw error;
    }
  }

  /**
   * Generates JWT tokens for an authenticated user
   * @param user - The authenticated user
   * @returns Access token and refresh token
   */
  private async generateTokens(user: User): Promise<{ accessToken: string; refreshToken: string }> {
    const logContext = this.logger.startOperation('AuthService.generateTokens', {
      userId: user.id,
      email: user.email,
      role: user.role,
    });

    try {
      // Prepare JWT payload
      const payload: UserJWTPayload = {
        id: user.id,
        email: user.email,
        role: user.role, // Include the role for role-based access control
        // Add other claims as needed
      };

      this.logger.info(
        {
          operation: 'AuthService.generateTokens',
          step: 'payload_prepared',
          userId: user.id,
          email: user.email,
          role: user.role,
          accessTokenExpiry: config.JWT_ACCESS_TOKEN_EXPIRY,
          refreshTokenExpiry: config.JWT_REFRESH_TOKEN_EXPIRY,
        },
        'JWT payload prepared for token generation',
      );

      // Generate JWTs with expiry times from config
      const accessToken = await this.fastify.jwt.sign(payload, {
        expiresIn: config.JWT_ACCESS_TOKEN_EXPIRY,
      });

      const refreshToken = await this.fastify.jwt.sign(payload, {
        expiresIn: config.JWT_REFRESH_TOKEN_EXPIRY,
      });

      this.logger.endOperation(logContext, 'JWT tokens generated successfully', {
        userId: user.id,
        email: user.email,
      });

      return { accessToken, refreshToken };
    } catch (error) {
      this.logger.errorOperation(logContext, error, 'JWT token generation failed', {
        userId: user.id,
        email: user.email,
      });
      throw error;
    }
  }

  /**
   * Refreshes the user's authentication token
   * @param refreshToken - The refresh token from the cookie
   * @returns The new access token and refresh token
   */
  async refreshToken(refreshToken: string): Promise<{ accessToken: string; refreshToken: string }> {
    const logContext = this.logger.startOperation('AuthService.refreshToken');

    try {
      this.logger.info(
        {
          operation: 'AuthService.refreshToken',
          step: 'verifying_token',
        },
        'Verifying refresh token',
      );

      // Verify the refresh token
      const decoded = await this.fastify.jwt.verify(refreshToken);

      if (!decoded || typeof decoded !== 'object') {
        this.logger.warn(
          {
            operation: 'AuthService.refreshToken',
            step: 'token_format_invalid',
            decodedType: typeof decoded,
          },
          'Invalid refresh token format',
        );

        throw new AuthenticationError('Invalid token format', 'INVALID_TOKEN_FORMAT');
      }

      const userPayload = decoded as UserJWTPayload;

      this.logger.info(
        {
          operation: 'AuthService.refreshToken',
          step: 'token_verified',
          userId: userPayload.id,
          email: userPayload.email,
        },
        'Refresh token verified successfully',
      );

      // Find the user in database using the id from the token payload
      const user = await this.userService.findUserById(userPayload.id);
      if (!user) {
        this.logger.warn(
          {
            operation: 'AuthService.refreshToken',
            step: 'user_not_found',
            userId: userPayload.id,
            email: userPayload.email,
          },
          'User not found in database during token refresh',
        );

        throw new AuthenticationError('User not found', 'USER_NOT_FOUND');
      }

      this.logger.info(
        {
          operation: 'AuthService.refreshToken',
          step: 'user_found',
          userId: user.id,
          email: user.email,
          role: user.role,
        },
        'User found in database for token refresh',
      );

      // Generate new tokens using the existing method
      const newTokens = await this.generateTokens(user);

      this.logger.endOperation(logContext, 'Token refresh completed successfully', {
        userId: user.id,
        email: user.email,
        role: user.role,
      });

      // Log business metrics
      this.logger.logMetric(
        'token_refresh_success',
        {
          userId: user.id,
          email: user.email,
          role: user.role,
        },
        'Successful token refresh',
      );

      return newTokens;
    } catch (error) {
      this.logger.errorOperation(logContext, error, 'Token refresh failed');

      // Always throw AuthenticationError for token issues
      if (error instanceof AuthenticationError) {
        throw error;
      }

      throw new AuthenticationError('Invalid refresh token', 'INVALID_REFRESH_TOKEN');
    }
  }

  // Add other auth methods like logout, refresh token handling, etc.
}
