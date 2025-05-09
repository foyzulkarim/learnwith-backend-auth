// src/modules/user/user.service.ts
import { FastifyInstance } from 'fastify';
import { User } from './types';
import { getUserModel, UserDocument } from './user.model';
import { ValidationError, DatabaseError } from '../../utils/errors';

// Define the structure of the Google profile data we expect
// This matches the OpenID Connect format that Google returns
export interface GoogleUserProfile {
  sub?: string; // OpenID Connect standard - Google's unique user ID
  id?: string; // Alternative ID field (for backward compatibility)
  name?: string; // User's full name
  given_name?: string; // User's first name
  family_name?: string; // User's last name
  email?: string; // User's email address
  email_verified?: boolean; // Whether email is verified
  picture?: string; // URL to user's profile picture

  // Legacy format support (for backward compatibility)
  displayName?: string;
  emails?: Array<{ value: string; verified?: boolean }>;
  photos?: Array<{ value: string }>;
  provider?: string;
}

export class UserService {
  private userModel;

  constructor(private fastify: FastifyInstance) {
    this.userModel = getUserModel();
  }

  /**
   * Finds an existing user by their Google ID or email,
   * or creates a new user if one doesn't exist.
   * @param profile - User profile information obtained from Google.
   * @returns The found or created User object.
   */
  async findOrCreateUserByGoogleProfile(profile: GoogleUserProfile): Promise<User> {
    try {
      // Get the Google ID (sub is the OpenID Connect standard)
      const googleId = profile.sub || profile.id;
      if (!googleId) {
        throw new ValidationError('Google profile ID is missing.', 'GOOGLE_PROFILE_INVALID');
      }

      // Get the email (direct email field or from the emails array)
      const email =
        profile.email ||
        (profile.emails && profile.emails.length > 0 ? profile.emails[0].value : undefined);

      if (!email) {
        throw new ValidationError('Google profile email is missing.', 'GOOGLE_PROFILE_INVALID');
      }

      // Get the name
      const name =
        profile.name ||
        profile.displayName ||
        `${profile.given_name || ''} ${profile.family_name || ''}`.trim() ||
        'User';

      // 1. Try to find user by Google ID
      let user = await this.userModel.findOne({ googleId });

      if (user) {
        // Optional: Update user's name or other details if they've changed in Google
        if (user.name !== name) {
          user.name = name;
          await user.save();
        }
        return this.convertToUser(user);
      }

      // 2. If not found by Google ID, try to find by email
      // This handles cases where a user might have previously signed up via email
      user = await this.userModel.findOne({ email });

      if (user) {
        // User exists with this email but hasn't linked Google yet.
        // Link the Google ID to the existing account.
        user.googleId = googleId;
        if (!user.name) user.name = name;
        await user.save();
        return this.convertToUser(user);
      }

      // 3. If not found by email either, create a new user
      user = await this.userModel.create({
        email,
        googleId,
        name,
        // Add other default fields if necessary
      });

      return this.convertToUser(user);
    } catch (error) {
      this.fastify.log.error({ err: error }, 'Error finding or creating user by Google profile');

      // If it's already one of our custom errors, rethrow it
      if (error instanceof ValidationError) {
        throw error;
      }

      // Map other errors to appropriate types
      if (error instanceof Error) {
        throw new DatabaseError(
          `Error creating or finding user: ${error.message}`,
          'USER_DB_ERROR',
        );
      }

      throw new DatabaseError(
        'Unknown error occurred while processing user data',
        'USER_UNKNOWN_ERROR',
      );
    }
  }

  /**
   * Finds a user by their ID
   * @param id - The user's ID
   * @returns The user or null if not found
   */
  async findUserById(id: string): Promise<User | null> {
    try {
      const user = await this.userModel.findById(id);
      if (!user) {
        return null;
      }
      return this.convertToUser(user);
    } catch (error) {
      this.fastify.log.error({ err: error, userId: id }, 'Error finding user by ID');
      throw new DatabaseError(
        `Error finding user: ${error instanceof Error ? error.message : 'Unknown error'}`,
        'USER_LOOKUP_ERROR',
      );
    }
  }

  /**
   * Converts a Mongoose user document to a plain User object
   * @param userDoc - The Mongoose user document
   * @returns A plain User object
   */
  private convertToUser(userDoc: UserDocument): User {
    const user = userDoc.toObject();
    return {
      id: user._id.toString(),
      email: user.email,
      name: user.name,
      googleId: user.googleId,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
    };
  }
}
