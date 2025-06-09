// src/modules/user/user.service.ts
import { FastifyInstance } from 'fastify';
import { User } from './types';
import { getUserModel, UserDocument } from './user.model';
import { CreateUserInput, UpdateUserInput, UserRole } from './user.schema'; // Import new schemas
import { ValidationError, DatabaseError, NotFoundError } from '../../utils/errors';
import { createLogger, Logger } from '../../utils/logger';
import { hashPassword } from '../../utils/hash'; // Import hashing utility

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
   * Creates a new user.
   * @param userData - Data for creating the user.
   * @returns The created user.
   */
  async createUser(userData: CreateUserInput): Promise<User> {
    const logContext = this.logger.startOperation('UserService.createUser', {
      email: userData.email,
      role: userData.role,
    });

    try {
      this.logger.info(
        { operation: 'UserService.createUser', step: 'hashing_password', email: userData.email },
        'Hashing user password',
      );
      const hashedPassword = await hashPassword(userData.password);

      this.logger.info(
        { operation: 'UserService.createUser', step: 'creating_user_in_db', email: userData.email },
        'Creating new user in database',
      );
      const newUserDoc = await this.userModel.create({
        ...userData,
        password: hashedPassword,
        role: userData.role || 'viewer', // Ensure role is set, defaulting if not provided
      });

      const result = this.convertToUser(newUserDoc);
      this.logger.endOperation(logContext, `User created successfully: ${result.email}`, {
        userId: result.id,
        email: result.email,
      });
      return result;
    } catch (error) {
      this.logger.errorOperation(logContext, error, 'Error creating user', { email: userData.email });
      if (error instanceof Error && error.message.includes('duplicate key error')) {
        throw new ValidationError('User with this email already exists.', 'USER_EMAIL_DUPLICATE');
      }
      throw new DatabaseError(
        `Error creating user: ${error instanceof Error ? error.message : 'Unknown error'}`,
        'USER_CREATE_ERROR',
      );
    }
  }

  /**
   * Retrieves all users.
   * @returns An array of all users.
   */
  async getAllUsers(): Promise<User[]> {
    const logContext = this.logger.startOperation('UserService.getAllUsers');
    try {
      this.logger.info(
        { operation: 'UserService.getAllUsers', step: 'fetching_all_users' },
        'Fetching all users from database',
      );
      const usersDocs = await this.userModel.find({});
      const users = usersDocs.map((doc) => this.convertToUser(doc));

      this.logger.endOperation(logContext, `Retrieved ${users.length} users successfully.`, {
        userCount: users.length,
      });
      return users;
    } catch (error) {
      this.logger.errorOperation(logContext, error, 'Error retrieving all users');
      throw new DatabaseError(
        `Error retrieving users: ${error instanceof Error ? error.message : 'Unknown error'}`,
        'USER_LIST_ERROR',
      );
    }
  }

  /**
   * Finds a user by their ID.
   * @param id - The user's ID.
   * @returns The user or null if not found.
   */
  async getUserById(id: string): Promise<User | null> {
    const logContext = this.logger.startOperation('UserService.getUserById', { userId: id });
    try {
      this.logger.info(
        { operation: 'UserService.getUserById', step: 'database_lookup', userId: id },
        'Looking up user by ID in database',
      );
      const userDoc = await this.userModel.findById(id);

      if (!userDoc) {
        this.logger.warn(
          { operation: 'UserService.getUserById', userId: id, found: false },
          `User not found: ${id}`,
        );
        this.logger.endOperation(logContext, `User not found: ${id}`, { userId: id, found: false });
        return null; // Consistent with original findUserById behavior for not found
      }

      const result = this.convertToUser(userDoc);
      this.logger.endOperation(logContext, `User found: ${result.email}`, {
        userId: result.id,
        email: result.email,
        found: true,
      });
      return result;
    } catch (error) {
      this.logger.errorOperation(logContext, error, 'Error finding user by ID', { userId: id });
      // Handle invalid ObjectId format specifically if possible, otherwise general DB error
      if (error instanceof Error && error.name === 'CastError') {
        throw new ValidationError('Invalid user ID format.', 'USER_ID_INVALID');
      }
      throw new DatabaseError(
        `Error finding user: ${error instanceof Error ? error.message : 'Unknown error'}`,
        'USER_LOOKUP_ERROR',
      );
    }
  }

  /**
   * Updates an existing user.
   * @param id - The ID of the user to update.
   * @param updateData - Data to update the user with.
   * @returns The updated user.
   */
  async updateUser(id: string, updateData: UpdateUserInput): Promise<User> {
    const logContext = this.logger.startOperation('UserService.updateUser', {
      userId: id,
      updateData,
    });
    try {
      this.logger.info(
        { operation: 'UserService.updateUser', step: 'finding_user_for_update', userId: id },
        'Finding user to update',
      );
      const userDoc = await this.userModel.findById(id);

      if (!userDoc) {
        this.logger.warn(
          { operation: 'UserService.updateUser', userId: id, found: false },
          `User not found for update: ${id}`,
        );
        throw new NotFoundError(`User with ID ${id} not found.`);
      }

      // Update provided fields
      if (updateData.name !== undefined) {
        userDoc.name = updateData.name;
      }
      if (updateData.email !== undefined) {
        userDoc.email = updateData.email;
      }
      if (updateData.role !== undefined) {
        userDoc.role = updateData.role as UserRole; // Cast to UserRole type
      }

      this.logger.info(
        { operation: 'UserService.updateUser', step: 'saving_updated_user', userId: id },
        'Saving updated user data',
      );
      const updatedUserDoc = await userDoc.save();
      const result = this.convertToUser(updatedUserDoc);

      this.logger.endOperation(logContext, `User updated successfully: ${result.email}`, {
        userId: result.id,
        email: result.email,
      });
      return result;
    } catch (error) {
      this.logger.errorOperation(logContext, error, 'Error updating user', { userId: id, updateData });
      if (error instanceof NotFoundError) throw error;
      if (error instanceof Error && error.message.includes('duplicate key error')) {
        throw new ValidationError('This email is already in use by another account.', 'USER_EMAIL_DUPLICATE_UPDATE');
      }
      throw new DatabaseError(
        `Error updating user: ${error instanceof Error ? error.message : 'Unknown error'}`,
        'USER_UPDATE_ERROR',
      );
    }
  }

  /**
   * Deletes a user by their ID.
   * @param id - The ID of the user to delete.
   * @returns Confirmation of deletion.
   */
  async deleteUser(id: string): Promise<{ success: boolean; message: string; userId: string }> {
    const logContext = this.logger.startOperation('UserService.deleteUser', { userId: id });
    try {
      this.logger.info(
        { operation: 'UserService.deleteUser', step: 'finding_user_for_deletion', userId: id },
        'Finding user to delete',
      );
      const userDoc = await this.userModel.findById(id);

      if (!userDoc) {
        this.logger.warn(
          { operation: 'UserService.deleteUser', userId: id, found: false },
          `User not found for deletion: ${id}`,
        );
        throw new NotFoundError(`User with ID ${id} not found.`);
      }

      this.logger.info(
        { operation: 'UserService.deleteUser', step: 'deleting_user_from_db', userId: id },
        'Deleting user from database',
      );
      await this.userModel.findByIdAndDelete(id);

      this.logger.endOperation(logContext, `User deleted successfully: ${id}`, { userId: id });
      return { success: true, message: 'User deleted successfully', userId: id };
    } catch (error) {
      this.logger.errorOperation(logContext, error, 'Error deleting user', { userId: id });
      if (error instanceof NotFoundError) throw error;
      throw new DatabaseError(
        `Error deleting user: ${error instanceof Error ? error.message : 'Unknown error'}`,
        'USER_DELETE_ERROR',
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
    });

    try {
      const googleId = profile.sub || profile.id;
      if (!googleId) {
        this.logger.warn(
          { operation: 'UserService.findOrCreateUserByGoogleProfile', step: 'validation_failed' },
          'Google profile ID is missing.',
        );
        throw new ValidationError('Google profile ID is missing.', 'GOOGLE_PROFILE_INVALID');
      }

      const email =
        profile.email ||
        (profile.emails && profile.emails.length > 0 ? profile.emails[0].value : undefined);

      if (!email) {
        this.logger.warn(
          { operation: 'UserService.findOrCreateUserByGoogleProfile', step: 'validation_failed', googleId },
          'Google profile email is missing.',
        );
        throw new ValidationError('Google profile email is missing.', 'GOOGLE_PROFILE_INVALID');
      }

      const name =
        profile.name ||
        profile.displayName ||
        `${profile.given_name || ''} ${profile.family_name || ''}`.trim() ||
        'User';

      this.logger.info(
        { operation: 'UserService.findOrCreateUserByGoogleProfile', step: 'profile_processed', googleId, email, name },
        'Google profile processed',
      );

      let userDoc = await this.userModel.findOne({ googleId });

      if (userDoc) {
        this.logger.info(
          { operation: 'UserService.findOrCreateUserByGoogleProfile', step: 'found_by_google_id', userId: userDoc._id.toString() },
          'User found by Google ID',
        );
        if (userDoc.name !== name) {
          userDoc.name = name;
          await userDoc.save();
        }
        const result = this.convertToUser(userDoc);
        this.logger.endOperation(logContext, `User found by Google ID: ${result.email}`, { userId: result.id, action: 'found_existing' });
        return result;
      }

      this.logger.info(
        { operation: 'UserService.findOrCreateUserByGoogleProfile', step: 'lookup_by_email', email },
        'Looking up user by email',
      );
      userDoc = await this.userModel.findOne({ email });

      if (userDoc) {
        this.logger.info(
          { operation: 'UserService.findOrCreateUserByGoogleProfile', step: 'found_by_email_linking_google', userId: userDoc._id.toString() },
          'User found by email, linking Google account',
        );
        userDoc.googleId = googleId;
        if (!userDoc.name) userDoc.name = name; // Only set name if it wasn't set
        await userDoc.save();
        const result = this.convertToUser(userDoc);
        this.logger.endOperation(logContext, `User found by email and linked: ${result.email}`, { userId: result.id, action: 'linked_google' });
        this.logger.logMetric('google_account_linked', { userId: result.id, email: result.email });
        return result;
      }

      this.logger.info(
        { operation: 'UserService.findOrCreateUserByGoogleProfile', step: 'creating_new_user', email, googleId },
        'Creating new user with Google profile',
      );
      userDoc = await this.userModel.create({
        email,
        googleId,
        name,
        role: 'viewer', // Default role
      });
      const result = this.convertToUser(userDoc);
      this.logger.endOperation(logContext, `New user created via Google: ${result.email}`, { userId: result.id, action: 'created_new' });
      this.logger.logMetric('user_created_via_google', { userId: result.id, email: result.email, role: result.role });
      return result;

    } catch (error) {
      this.logger.errorOperation(logContext, error, 'Error in findOrCreateUserByGoogleProfile', { googleId: profile.sub || profile.id, email: profile.email });
      if (error instanceof ValidationError || error instanceof DatabaseError) {
        throw error;
      }
      throw new DatabaseError(
        `Error processing Google profile: ${error instanceof Error ? error.message : 'Unknown error'}`,
        'GOOGLE_PROFILE_PROCESSING_ERROR',
      );
    }
  }

  /**
   * Converts a Mongoose user document to a plain User object.
   * Ensures all fields expected by the User type are present.
   * @param userDoc - The Mongoose user document.
   * @returns A plain User object.
   */
  private convertToUser(userDoc: UserDocument): User {
    const userObject = userDoc.toObject({ virtuals: true }); // Ensure virtuals like id are included if defined in schema
    return {
      id: userObject._id.toString(), // Mongoose typically uses _id
      email: userObject.email,
      name: userObject.name || null, // Ensure name is null if not present, not undefined
      googleId: userObject.googleId || null,
      role: userObject.role || 'viewer', // Default role if not set
      password: userObject.password || null, // Include password if it exists on the model, though it's often excluded
      createdAt: userObject.createdAt,
      updatedAt: userObject.updatedAt,
    };
  }
}
