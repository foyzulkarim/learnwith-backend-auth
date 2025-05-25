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

export class AuthService {
  // Inject dependencies (Fastify instance for JWT signing, UserService)
  constructor(
    private fastify: FastifyInstance,
    private userService: UserService,
  ) {}

  /**
   * Processes Google user profile, finds/creates user, and generates JWT.
   * @param googleProfile - User profile data from Google.
   * @returns The generated JWTs (accessToken and refreshToken).
   */
  async processGoogleLogin(
    googleProfile: GoogleUserProfile,
  ): Promise<{ accessToken: string; refreshToken: string }> {
    try {
      // Validate Google profile has all required fields
      this.validateGoogleProfile(googleProfile);

      // Find or create user in the database using the original Google profile
      const user = await this.userService.findOrCreateUserByGoogleProfile(googleProfile);

      // Generate tokens for the user
      return this.generateTokens(user);
    } catch (error) {
      this.fastify.log.error({ err: error }, 'Error processing Google login');

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
    const requiredFields = ['sub', 'email'];
    const missingFields = requiredFields.filter(
      (field) => !profile[field as keyof GoogleUserProfile],
    );

    if (missingFields.length > 0) {
      throw new ValidationError(
        `Google profile missing required fields: ${missingFields.join(', ')}`,
        'GOOGLE_PROFILE_INVALID',
      );
    }

    // Ensure the email is verified (Google should ensure this, but double-check)
    if (profile.email_verified === false) {
      throw new ValidationError('Google email is not verified', 'GOOGLE_EMAIL_UNVERIFIED');
    }
  }

  /**
   * Generates JWT tokens for an authenticated user
   * @param user - The authenticated user
   * @returns Access token and refresh token
   */
  private async generateTokens(user: User): Promise<{ accessToken: string; refreshToken: string }> {
    // Prepare JWT payload
    const payload: UserJWTPayload = {
      id: user.id,
      email: user.email,
      role: user.role, // Include the role for role-based access control
      // Add other claims as needed
    };

    // Generate JWTs with expiry times from config
    const accessToken = await this.fastify.jwt.sign(payload, {
      expiresIn: config.JWT_ACCESS_TOKEN_EXPIRY,
    });

    const refreshToken = await this.fastify.jwt.sign(payload, {
      expiresIn: config.JWT_REFRESH_TOKEN_EXPIRY,
    });

    return { accessToken, refreshToken };
  }

  /**
   * Refreshes the user's authentication token
   * @param refreshToken - The refresh token from the cookie
   * @returns The new access token and refresh token
   */
  async refreshToken(refreshToken: string): Promise<{ accessToken: string; refreshToken: string }> {
    const fastify = this.fastify;

    try {
      // Verify the refresh token
      const decoded = await fastify.jwt.verify(refreshToken);

      if (!decoded || typeof decoded !== 'object') {
        throw new AuthenticationError('Invalid token format', 'INVALID_TOKEN_FORMAT');
      }

      // Find the user in database using the id from the token payload
      const user = await this.userService.findUserById(decoded.id);
      if (!user) {
        throw new AuthenticationError('User not found', 'USER_NOT_FOUND');
      }

      // Generate new tokens using the existing method
      return this.generateTokens(user);
    } catch (error) {
      fastify.log.error({ err: error }, 'Token refresh failed');
      throw new AuthenticationError('Invalid refresh token', 'INVALID_REFRESH_TOKEN');
    }
  }

  // Add other auth methods like logout, refresh token handling, etc.
}
