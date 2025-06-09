// src/modules/user/user.service.ts
import { FastifyInstance } from 'fastify';
import { User } from './types';
import { getUserModel, UserDocument } from './user.model';
import {
  // CreateUserInput, // Removed as createUser method is deleted
  UpdateUserInput,
  UserRole,
  GetAllUsersQueryType, // Import for query parameters
  PaginatedUsersResponseType, // Import for the new response structure
} from './user.schema';
import { ValidationError, DatabaseError, NotFoundError } from '../../utils/errors';
import { createLogger, Logger } from '../../utils/logger';
// import { hashPassword } from '../../utils/hash'; // Removed as no longer used

export interface GoogleUserProfile {
  sub?: string;
  id?: string;
  name?: string;
  given_name?: string;
  family_name?: string;
  email?: string;
  email_verified?: boolean;
  picture?: string;
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
   * Retrieves a paginated, sorted, and filtered list of users.
   */
  async getAllUsers(options: GetAllUsersQueryType): Promise<PaginatedUsersResponseType> {
    const logContext = this.logger.startOperation('UserService.getAllUsers', { options });
    try {
      const {
        page = 1,
        limit = 10,
        sortBy = 'createdAt',
        sortOrder = 'desc',
        search,
        role,
        isDeleted = false, // Default to not showing deleted users unless explicitly requested
      } = options;

      const queryConditions: any = { isDeleted };

      if (search) {
        const searchRegex = new RegExp(search, 'i');
        queryConditions.$or = [{ name: searchRegex }, { email: searchRegex }];
      }

      if (role) {
        queryConditions.role = role;
      }

      this.logger.info({ operation: 'UserService.getAllUsers', step: 'query_construction', queryConditions }, 'Constructed query conditions');

      const sortOptions: any = {};
      sortOptions[sortBy] = sortOrder === 'asc' ? 1 : -1;

      const skip = (page - 1) * limit;

      this.logger.info({ operation: 'UserService.getAllUsers', step: 'fetching_users_from_db', queryConditions, sortOptions, skip, limit }, 'Fetching users from database');
      const usersDocs = await this.userModel
        .find(queryConditions)
        .sort(sortOptions)
        .skip(skip)
        .limit(limit)
        .exec();

      this.logger.info({ operation: 'UserService.getAllUsers', step: 'counting_total_users', queryConditions }, 'Counting total users');
      const totalUsers = await this.userModel.countDocuments(queryConditions);

      const users = usersDocs.map((doc) => this.convertToUser(doc));
      const totalPages = Math.ceil(totalUsers / limit);

      const response = { users, totalUsers, totalPages, currentPage: page, limit };
      this.logger.endOperation(logContext, `Retrieved ${users.length} users successfully.`, { response });
      return response;

    } catch (error) {
      this.logger.errorOperation(logContext, error, 'Error retrieving all users', { options });
      throw new DatabaseError(`Error retrieving users: ${error instanceof Error ? error.message : 'Unknown error'}`, 'USER_LIST_ERROR');
    }
  }

  /**
   * Finds a user by their ID, optionally including soft-deleted users.
   */
  async getUserById(id: string, includeDeleted: boolean = false): Promise<User | null> {
    const logContext = this.logger.startOperation('UserService.getUserById', { userId: id, includeDeleted });
    try {
      const queryConditions: any = { _id: id };
      if (!includeDeleted) {
        queryConditions.isDeleted = false;
      }

      this.logger.info({ operation: 'UserService.getUserById', step: 'database_lookup', queryConditions }, 'Looking up user by ID in database');
      const userDoc = await this.userModel.findOne(queryConditions);

      if (!userDoc) {
        this.logger.warn({ /* ... */ }, `User not found: ${id}`);
        this.logger.endOperation(logContext, `User not found: ${id}`, { found: false });
        return null;
      }

      const result = this.convertToUser(userDoc);
      this.logger.endOperation(logContext, `User found: ${result.email}`, { found: true });
      return result;
    } catch (error) {
      this.logger.errorOperation(logContext, error, 'Error finding user by ID', { userId: id });
      if (error instanceof Error && error.name === 'CastError') {
        throw new ValidationError('Invalid user ID format.', 'USER_ID_INVALID');
      }
      throw new DatabaseError(`Error finding user: ${error instanceof Error ? error.message : 'Unknown error'}`, 'USER_LOOKUP_ERROR');
    }
  }

  /**
   * Updates an existing non-deleted user.
   * Does not allow updating isDeleted or deletedAt.
   */
  async updateUser(id: string, updateData: UpdateUserInput): Promise<User> {
    const logContext = this.logger.startOperation('UserService.updateUser', { userId: id, updateData });
    try {
      this.logger.info({ /* ... */ }, 'Finding non-deleted user to update');
      // Ensure we only update non-deleted users
      const userDoc = await this.userModel.findOne({ _id: id, isDeleted: false });

      if (!userDoc) {
        this.logger.warn({ /* ... */ }, `Non-deleted user not found for update: ${id}`);
        throw new NotFoundError(`User with ID ${id} not found or has been deleted.`);
      }

      if (updateData.name !== undefined) userDoc.name = updateData.name;
      if (updateData.email !== undefined) userDoc.email = updateData.email;
      if (updateData.role !== undefined) userDoc.role = updateData.role as UserRole;

      this.logger.info({ /* ... */ }, 'Saving updated user data');
      const updatedUserDoc = await userDoc.save();
      const result = this.convertToUser(updatedUserDoc);

      this.logger.endOperation(logContext, `User updated successfully: ${result.email}`, { /* ... */ });
      return result;
    } catch (error) {
      this.logger.errorOperation(logContext, error, 'Error updating user', { /* ... */ });
      if (error instanceof NotFoundError) throw error;
      if (error instanceof Error && error.message.includes('duplicate key error')) {
        throw new ValidationError('This email is already in use by another account.', 'USER_EMAIL_DUPLICATE_UPDATE');
      }
      throw new DatabaseError(`Error updating user: ${error instanceof Error ? error.message : 'Unknown error'}`, 'USER_UPDATE_ERROR');
    }
  }

  /**
   * Soft deletes a user by their ID.
   */
  async deleteUser(id: string): Promise<User> { // Changed return type
    const logContext = this.logger.startOperation('UserService.deleteUser', { userId: id });
    try {
      this.logger.info({ /* ... */ }, 'Finding user to soft delete');
      // Check if user exists and is not already deleted.
      // If you want to allow "re-deleting" a deleted user (just updating deletedAt), remove isDeleted: false.
      const userDoc = await this.userModel.findOne({ _id: id, isDeleted: false });

      if (!userDoc) {
        this.logger.warn({ /* ... */ }, `User not found or already deleted: ${id}`);
        throw new NotFoundError(`User with ID ${id} not found or already deleted.`);
      }

      userDoc.isDeleted = true;
      userDoc.deletedAt = new Date();

      this.logger.info({ operation: 'UserService.deleteUser', step: 'soft_deleting_user_in_db', userId: id }, 'Soft deleting user in database');
      const softDeletedUserDoc = await userDoc.save();
      const result = this.convertToUser(softDeletedUserDoc);

      this.logger.endOperation(logContext, `User soft deleted successfully: ${id}`, { /* ... */ });
      return result; // Return the soft-deleted user object
    } catch (error) {
      this.logger.errorOperation(logContext, error, 'Error soft deleting user', { userId: id });
      if (error instanceof NotFoundError) throw error;
      throw new DatabaseError(`Error soft deleting user: ${error instanceof Error ? error.message : 'Unknown error'}`, 'USER_DELETE_ERROR');
    }
  }

  /**
   * Finds an existing non-deleted user by their Google ID or email,
   * or creates a new user if one doesn't exist.
   */
  async findOrCreateUserByGoogleProfile(profile: GoogleUserProfile): Promise<User> {
    const logContext = this.logger.startOperation('UserService.findOrCreateUserByGoogleProfile', { /* ... */ });
    try {
      const googleId = profile.sub || profile.id;
      if (!googleId) { /* ... */ throw new ValidationError('Google profile ID is missing.', 'GOOGLE_PROFILE_INVALID'); }
      const email = profile.email || (profile.emails && profile.emails.length > 0 ? profile.emails[0].value : undefined);
      if (!email) { /* ... */ throw new ValidationError('Google profile email is missing.', 'GOOGLE_PROFILE_INVALID'); }
      const name = profile.name || profile.displayName || `${profile.given_name || ''} ${profile.family_name || ''}`.trim() || 'User';

      this.logger.info({ /* ... */ }, 'Google profile processed');

      // Look for non-deleted user by Google ID
      let userDoc = await this.userModel.findOne({ googleId, isDeleted: false });

      if (userDoc) {
        this.logger.info({ /* ... */ }, 'Non-deleted user found by Google ID');
        if (userDoc.name !== name) {
          userDoc.name = name;
          await userDoc.save();
        }
        const result = this.convertToUser(userDoc);
        this.logger.endOperation(logContext, `User found by Google ID: ${result.email}`, { /* ... */ });
        return result;
      }

      this.logger.info({ /* ... */ }, 'Looking up non-deleted user by email');
      // Look for non-deleted user by email
      userDoc = await this.userModel.findOne({ email, isDeleted: false });

      if (userDoc) {
        this.logger.info({ /* ... */ }, 'Non-deleted user found by email, linking Google account');
        userDoc.googleId = googleId;
        if (!userDoc.name) userDoc.name = name;
        await userDoc.save();
        const result = this.convertToUser(userDoc);
        this.logger.endOperation(logContext, `User found by email and linked: ${result.email}`, { /* ... */ });
        this.logger.logMetric('google_account_linked', { /* ... */ });
        return result;
      }

      this.logger.info({ /* ... */ }, 'Creating new user with Google profile');
      // isDeleted and deletedAt will use model defaults
      userDoc = await this.userModel.create({ email, googleId, name, role: 'viewer' });
      const result = this.convertToUser(userDoc);
      this.logger.endOperation(logContext, `New user created via Google: ${result.email}`, { /* ... */ });
      this.logger.logMetric('user_created_via_google', { /* ... */ });
      return result;

    } catch (error) {
      this.logger.errorOperation(logContext, error, 'Error in findOrCreateUserByGoogleProfile', { /* ... */ });
      if (error instanceof ValidationError || error instanceof DatabaseError) throw error;
      throw new DatabaseError(`Error processing Google profile: ${error instanceof Error ? error.message : 'Unknown error'}`, 'GOOGLE_PROFILE_PROCESSING_ERROR');
    }
  }

  /**
   * Converts a Mongoose user document to a plain User object.
   */
  private convertToUser(userDoc: UserDocument): User {
    const userObject = userDoc.toObject({ virtuals: true });
    return {
      id: userObject._id.toString(),
      email: userObject.email,
      name: userObject.name || null,
      googleId: userObject.googleId || null,
      role: userObject.role || 'viewer',
      password: userObject.password || null, // Typically null in responses unless specifically needed
      createdAt: userObject.createdAt,
      updatedAt: userObject.updatedAt,
      isDeleted: userObject.isDeleted ?? false, // Default to false if undefined
      deletedAt: userObject.deletedAt || null, // Default to null if undefined
    };
  }

  /**
   * Restores a soft-deleted user by their ID.
   */
  async restoreUser(id: string): Promise<User> {
    const logContext = this.logger.startOperation('UserService.restoreUser', { userId: id });
    try {
      this.logger.info({ operation: 'UserService.restoreUser', step: 'finding_deleted_user', userId: id }, 'Finding soft-deleted user to restore');

      // Find a user that is specifically marked as deleted
      const userDoc = await this.userModel.findOne({ _id: id, isDeleted: true });

      if (!userDoc) {
        this.logger.warn({ operation: 'UserService.restoreUser', userId: id, found: false }, `Soft-deleted user not found or user is not deleted: ${id}`);
        throw new NotFoundError(`User with ID ${id} not found or is not currently soft-deleted.`);
      }

      userDoc.isDeleted = false;
      userDoc.deletedAt = null;

      this.logger.info({ operation: 'UserService.restoreUser', step: 'restoring_user_in_db', userId: id }, 'Restoring user in database');
      const restoredUserDoc = await userDoc.save();
      const result = this.convertToUser(restoredUserDoc);

      this.logger.endOperation(logContext, `User restored successfully: ${id}`, { userId: result.id, email: result.email });
      return result;
    } catch (error) {
      this.logger.errorOperation(logContext, error, 'Error restoring user', { userId: id });
      if (error instanceof NotFoundError) throw error;
      throw new DatabaseError(`Error restoring user: ${error instanceof Error ? error.message : 'Unknown error'}`, 'USER_RESTORE_ERROR');
    }
  }
}
