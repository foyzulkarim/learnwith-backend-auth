// src/modules/user/user.service.ts
import { FastifyInstance } from 'fastify';
import { User } from './types';
import { getUserModel, UserDocument } from './user.model';
import { ValidationError, DatabaseError } from '../../utils/errors';
import { createLogger, Logger } from '../../utils/logger';

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
  private logger: Logger;

  constructor(private fastify: FastifyInstance) {
    this.userModel = getUserModel();
    this.logger = createLogger(fastify);
  }

  /**
   * Updates a user's profile information
   * @param userId - The user's ID
   * @param profileData - The updated profile data
   * @returns The updated user or null if not found
   */
  async updateProfile(
    userId: string,
    profileData: {
      name?: string;
      email?: string;
      bio?: string;
      emailPreferences?: {
        marketing?: boolean;
        coursesUpdates?: boolean;
        accountNotifications?: boolean;
      };
    },
  ): Promise<User | null> {
    const logContext = this.logger.startOperation('UserService.updateProfile', {
      userId,
      updateFields: Object.keys(profileData),
    });

    try {
      // Prepare the update object with only the fields that are provided
      const updateData: any = {};
      
      if (profileData.name !== undefined) updateData.name = profileData.name;
      if (profileData.bio !== undefined) updateData.bio = profileData.bio;
      
      // Handle email update (needs validation)
      if (profileData.email !== undefined) {
        // Check if email is already taken by another user
        const existingUser = await this.userModel.findOne({ 
          email: profileData.email,
          _id: { $ne: userId } 
        });
        
        if (existingUser) {
          this.logger.warn(
            {
              operation: 'UserService.updateProfile',
              userId,
              email: profileData.email,
              conflict: true,
            },
            `Email ${profileData.email} is already in use by another user`,
          );
          throw new ValidationError('Email is already in use', 'EMAIL_ALREADY_IN_USE');
        }
        
        updateData.email = profileData.email;
      }
      
      // Handle emailPreferences update
      if (profileData.emailPreferences) {
        const preferences = profileData.emailPreferences;
        
        // Use $set for nested fields, only including the provided ones
        if (preferences.marketing !== undefined) {
          updateData['emailPreferences.marketing'] = preferences.marketing;
        }
        if (preferences.coursesUpdates !== undefined) {
          updateData['emailPreferences.coursesUpdates'] = preferences.coursesUpdates;
        }
        if (preferences.accountNotifications !== undefined) {
          updateData['emailPreferences.accountNotifications'] = preferences.accountNotifications;
        }
      }

      // Skip the update if there's nothing to update
      if (Object.keys(updateData).length === 0) {
        const user = await this.userModel.findById(userId);
        if (!user) {
          this.logger.warn(
            {
              operation: 'UserService.updateProfile',
              userId,
              found: false,
            },
            `User not found: ${userId}`,
          );
          
          this.logger.endOperation(logContext, `User not found: ${userId}`, { userId, found: false });
          return null;
        }
        
        return this.convertToUser(user);
      }

      this.logger.info(
        {
          operation: 'UserService.updateProfile',
          userId,
          updateFields: Object.keys(updateData),
        },
        `Updating user profile: ${userId}`,
      );

      const user = await this.userModel.findByIdAndUpdate(
        userId,
        { $set: updateData },
        { new: true, runValidators: true },
      );

      if (!user) {
        this.logger.warn(
          {
            operation: 'UserService.updateProfile',
            userId,
            found: false,
          },
          `User not found: ${userId}`,
        );
        
        this.logger.endOperation(logContext, `User not found: ${userId}`, { userId, found: false });
        return null;
      }

      const result = this.convertToUser(user);

      this.logger.endOperation(logContext, `User profile updated: ${result.email}`, {
        userId: result.id,
        email: result.email,
        updateFields: Object.keys(updateData),
      });

      return result;
    } catch (error) {
      this.logger.errorOperation(
        logContext,
        error,
        `Error updating user profile: ${userId}`,
        {
          userId,
          updateFields: Object.keys(profileData),
        },
      );

      // If it's already one of our custom errors, rethrow it
      if (error instanceof ValidationError) {
        throw error;
      }

      // Map other errors to appropriate types
      throw new DatabaseError(
        `Error updating user: ${error instanceof Error ? error.message : 'Unknown error'}`,
        'USER_UPDATE_ERROR',
      );
    }
  }

  /**
   * Finds an existing user by their Google ID or email,
   * or creates a new user if one doesn't exist.
   * @param profile - User profile information obtained from Google.
   * @returns The found or created User object.
   */
  async findOrCreateUserByGoogleProfile(profile: GoogleUserProfile): Promise<User> {
    const logContext = this.logger.startOperation('UserService.findOrCreateUserByGoogleProfile', {
      googleId: profile.sub || profile.id,
      email: profile.email,
      hasName: !!(profile.name || profile.displayName),
      provider: profile.provider,
    });

    try {
      // Get the Google ID (sub is the OpenID Connect standard)
      const googleId = profile.sub || profile.id;
      if (!googleId) {
        this.logger.warn(
          {
            operation: 'UserService.findOrCreateUserByGoogleProfile',
            step: 'validation_failed',
            providedFields: Object.keys(profile),
          },
          'Google profile ID validation failed',
        );

        throw new ValidationError('Google profile ID is missing.', 'GOOGLE_PROFILE_INVALID');
      }

      // Get the email (direct email field or from the emails array)
      const email =
        profile.email ||
        (profile.emails && profile.emails.length > 0 ? profile.emails[0].value : undefined);

      if (!email) {
        this.logger.warn(
          {
            operation: 'UserService.findOrCreateUserByGoogleProfile',
            step: 'validation_failed',
            googleId,
            hasDirectEmail: !!profile.email,
            hasEmailsArray: !!(profile.emails && profile.emails.length > 0),
          },
          'Google profile email validation failed',
        );

        throw new ValidationError('Google profile email is missing.', 'GOOGLE_PROFILE_INVALID');
      }

      // Get the name
      const name =
        profile.name ||
        profile.displayName ||
        `${profile.given_name || ''} ${profile.family_name || ''}`.trim() ||
        'User';

      this.logger.info(
        {
          operation: 'UserService.findOrCreateUserByGoogleProfile',
          step: 'profile_processed',
          googleId,
          email,
          name,
        },
        'Google profile processed successfully',
      );

      // 1. Try to find user by Google ID
      this.logger.info(
        {
          operation: 'UserService.findOrCreateUserByGoogleProfile',
          step: 'lookup_by_google_id',
          googleId,
        },
        'Looking up user by Google ID',
      );

      let user = await this.userModel.findOne({ googleId });

      if (user) {
        this.logger.info(
          {
            operation: 'UserService.findOrCreateUserByGoogleProfile',
            step: 'found_by_google_id',
            userId: user._id.toString(),
            email: user.email,
            googleId,
          },
          'User found by Google ID',
        );

        // Optional: Update user's name or other details if they've changed in Google
        if (user.name !== name) {
          this.logger.info(
            {
              operation: 'UserService.findOrCreateUserByGoogleProfile',
              step: 'updating_name',
              userId: user._id.toString(),
              oldName: user.name,
              newName: name,
            },
            'Updating user name from Google profile',
          );

          user.name = name;
          await user.save();
        }

        const result = this.convertToUser(user);

        this.logger.endOperation(logContext, `User found by Google ID: ${result.email}`, {
          userId: result.id,
          email: result.email,
          googleId,
          action: 'found_existing',
        });

        return result;
      }

      // 2. If not found by Google ID, try to find by email
      // This handles cases where a user might have previously signed up via email
      this.logger.info(
        {
          operation: 'UserService.findOrCreateUserByGoogleProfile',
          step: 'lookup_by_email',
          email,
        },
        'User not found by Google ID, looking up by email',
      );

      user = await this.userModel.findOne({ email });

      if (user) {
        this.logger.info(
          {
            operation: 'UserService.findOrCreateUserByGoogleProfile',
            step: 'found_by_email_linking_google',
            userId: user._id.toString(),
            email: user.email,
            googleId,
          },
          'User found by email, linking Google account',
        );

        // User exists with this email but hasn't linked Google yet.
        // Link the Google ID to the existing account.
        user.googleId = googleId;
        if (!user.name) user.name = name;
        await user.save();

        const result = this.convertToUser(user);

        this.logger.endOperation(
          logContext,
          `User found by email and linked to Google: ${result.email}`,
          {
            userId: result.id,
            email: result.email,
            googleId,
            action: 'linked_google',
          },
        );

        // Log business metrics
        this.logger.logMetric(
          'google_account_linked',
          {
            userId: result.id,
            email: result.email,
            googleId,
          },
          'Google account linked to existing user',
        );

        return result;
      }

      // 3. If not found by email either, create a new user
      this.logger.info(
        {
          operation: 'UserService.findOrCreateUserByGoogleProfile',
          step: 'creating_new_user',
          email,
          googleId,
          name,
        },
        'User not found by email or Google ID, creating new user',
      );

      user = await this.userModel.create({
        email,
        googleId,
        name,
        role: 'viewer', // Default role for new users
        // Add other default fields if necessary
      });

      const result = this.convertToUser(user);

      this.logger.endOperation(logContext, `New user created: ${result.email}`, {
        userId: result.id,
        email: result.email,
        googleId,
        role: result.role,
        action: 'created_new',
      });

      // Log business metrics
      this.logger.logMetric(
        'user_created_via_google',
        {
          userId: result.id,
          email: result.email,
          googleId,
          role: result.role,
        },
        'New user created via Google OAuth',
      );

      return result;
    } catch (error) {
      this.logger.errorOperation(
        logContext,
        error,
        'Error finding or creating user by Google profile',
        {
          googleId: profile.sub || profile.id,
          email: profile.email,
        },
      );

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
    const logContext = this.logger.startOperation('UserService.findUserById', {
      userId: id,
    });

    try {
      this.logger.info(
        {
          operation: 'UserService.findUserById',
          step: 'database_lookup',
          userId: id,
        },
        'Looking up user by ID in database',
      );

      const user = await this.userModel.findById(id);

      if (!user) {
        this.logger.warn(
          {
            operation: 'UserService.findUserById',
            userId: id,
            found: false,
          },
          `User not found: ${id}`,
        );

        this.logger.endOperation(logContext, `User not found: ${id}`, { userId: id, found: false });

        return null;
      }

      const result = this.convertToUser(user);

      this.logger.endOperation(logContext, `User found: ${result.email}`, {
        userId: result.id,
        email: result.email,
        role: result.role,
        found: true,
      });

      return result;
    } catch (error) {
      this.logger.errorOperation(logContext, error, 'Error finding user by ID', { userId: id });

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
      role: user.role,
      bio: user.bio || '',
      emailPreferences: {
        marketing: user.emailPreferences?.marketing ?? true,
        coursesUpdates: user.emailPreferences?.coursesUpdates ?? true,
        accountNotifications: user.emailPreferences?.accountNotifications ?? true,
      },
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
    };
  }
}
