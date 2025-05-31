// src/modules/user/user.service.ts
import { FastifyInstance, FastifyRequest } from 'fastify';
import { getUserModel, UserDocument } from './user.model';
import { createServiceLogger } from '../../utils/logger';

// Define interfaces for user operations
interface CreateUserData {
  email: string;
  googleId?: string;
  firstName?: string;
  lastName?: string;
  profilePictureUrl?: string;
  role?: string;
  isEmailVerified?: boolean;
}

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

export class UserService {
  private userModel;
  private logger = createServiceLogger('UserService');

  constructor(private fastify: FastifyInstance) {
    this.userModel = getUserModel();
  }

  /**
   * Find or create a user based on Google profile information
   * @param googleProfile - The Google profile data
   * @param request - Optional request object for better correlation
   * @returns The found or created user
   */
  async findOrCreateGoogleUser(
    googleProfile: GoogleProfile,
    request?: FastifyRequest,
  ): Promise<UserDocument> {
    const logMethod = request ? request.log : this.logger;

    // Basic validation of the Google profile
    logMethod.debug('Processing Google profile for user lookup/creation');

    // Check for required Google ID
    const googleId = googleProfile.id || googleProfile.sub;
    if (!googleId) {
      logMethod.warn('Google profile missing ID field');
      throw new Error('Google profile missing required ID field');
    }

    // Check for email (required for user creation)
    const email = googleProfile.email;
    if (!email) {
      logMethod.warn(
        { googleId: googleId.substring(0, 5) + '...' },
        'Google profile missing email',
      );
      throw new Error('Google profile missing required email field');
    }

    logMethod.debug(
      {
        googleId: googleId.substring(0, 5) + '...',
        hasEmail: !!email,
        hasName: !!(googleProfile.name || googleProfile.given_name || googleProfile.family_name),
        hasProfilePicture: !!googleProfile.picture,
      },
      'Google profile validated successfully',
    );

    // Try to find existing user by Google ID or email
    let user = await this.userModel.findOne({
      $or: [{ googleId }, { email: email.toLowerCase() }],
    });

    if (user) {
      // Update Google ID if it wasn't set before
      if (!user.googleId && googleId) {
        user.googleId = googleId;
        await user.save();
      }

      return user;
    }

    // Create new user
    const name =
      googleProfile.name ||
      `${googleProfile.given_name || ''} ${googleProfile.family_name || ''}`.trim() ||
      'User';

    try {
      user = await this.userModel.create({
        email: email.toLowerCase(),
        googleId,
        name,
        role: 'student', // Default role
      });

      logMethod.info(
        {
          userId: user._id.toString(),
          email: user.email,
          role: user.role,
        },
        'New user created from Google profile',
      );

      return user;
    } catch (error) {
      logMethod.error(
        {
          err: error,
          email: email.toLowerCase(),
          googleId: googleId.substring(0, 5) + '...',
        },
        'Failed to create user from Google profile',
      );
      throw error;
    }
  }

  /**
   * Find a user by their ID
   * @param id - The user ID to search for
   * @param request - Optional request object for better correlation
   * @returns The user if found, null otherwise
   */
  async findById(id: string, request?: FastifyRequest): Promise<UserDocument | null> {
    const logMethod = request ? request.log : this.logger;

    try {
      const user = await this.userModel.findById(id);

      if (user) {
        logMethod.debug(
          {
            userId: id,
            email: user.email,
            role: user.role,
          },
          'User found by ID',
        );
      } else {
        logMethod.debug({ userId: id }, 'User not found by ID');
      }

      return user;
    } catch (error) {
      logMethod.error({ err: error, userId: id }, 'Error finding user by ID');
      throw error;
    }
  }

  /**
   * Find a user by their email address
   * @param email - The email address to search for
   * @param request - Optional request object for better correlation
   * @returns The user if found, null otherwise
   */
  async findByEmail(email: string, request?: FastifyRequest): Promise<UserDocument | null> {
    const logMethod = request ? request.log : this.logger;

    try {
      const user = await this.userModel.findOne({ email: email.toLowerCase() });

      if (user) {
        logMethod.debug(
          {
            userId: user._id.toString(),
            email: user.email,
            role: user.role,
          },
          'User found by email',
        );
      } else {
        logMethod.debug({ email }, 'User not found by email');
      }

      return user;
    } catch (error) {
      logMethod.error({ err: error, email }, 'Error finding user by email');
      throw error;
    }
  }

  /**
   * Create a new user
   * @param userData - The data for creating the user
   * @param request - Optional request object for better correlation
   * @returns The created user
   */
  async createUser(userData: CreateUserData, request?: FastifyRequest): Promise<UserDocument> {
    const logMethod = request ? request.log : this.logger;

    try {
      // Build the user data compatible with the schema
      const name =
        userData.firstName && userData.lastName
          ? `${userData.firstName} ${userData.lastName}`
          : userData.firstName || userData.lastName || 'User';

      const userDoc = {
        email: userData.email.toLowerCase(),
        name,
        googleId: userData.googleId,
        role: userData.role || 'student', // Default role
      };

      const user = await this.userModel.create(userDoc);

      logMethod.info(
        {
          userId: user._id.toString(),
          email: user.email,
          role: user.role,
        },
        'New user created',
      );

      return user;
    } catch (error) {
      logMethod.error(
        {
          err: error,
          email: userData.email,
        },
        'Failed to create user',
      );
      throw error;
    }
  }

  /**
   * Update a user's information
   * @param id - The user ID to update
   * @param updateData - The data to update
   * @param request - Optional request object for better correlation
   * @returns The updated user if found, null otherwise
   */
  async updateUser(
    id: string,
    updateData: Partial<CreateUserData>,
    request?: FastifyRequest,
  ): Promise<UserDocument | null> {
    const logMethod = request ? request.log : this.logger;

    try {
      // Build compatible update data
      const updateDoc: any = {};

      if (updateData.email) {
        updateDoc.email = updateData.email.toLowerCase();
      }

      if (updateData.firstName || updateData.lastName) {
        const name = `${updateData.firstName || ''} ${updateData.lastName || ''}`.trim();
        if (name) updateDoc.name = name;
      }

      if (updateData.googleId !== undefined) {
        updateDoc.googleId = updateData.googleId;
      }

      if (updateData.role) {
        updateDoc.role = updateData.role;
      }

      const user = await this.userModel.findByIdAndUpdate(
        id,
        { $set: updateDoc },
        { new: true, runValidators: true },
      );

      if (user) {
        logMethod.info(
          {
            userId: id,
            updatedFields: Object.keys(updateDoc),
            email: user.email,
          },
          'User updated successfully',
        );
      } else {
        logMethod.warn({ userId: id }, 'User not found during update attempt');
      }

      return user;
    } catch (error) {
      logMethod.error(
        {
          err: error,
          userId: id,
          updateData,
        },
        'Failed to update user',
      );
      throw error;
    }
  }

  /**
   * Delete a user by ID
   * @param id - The user ID to delete
   * @param request - Optional request object for better correlation
   * @returns True if deleted, false if not found
   */
  async deleteUser(id: string, request?: FastifyRequest): Promise<boolean> {
    const logMethod = request ? request.log : this.logger;

    try {
      const result = await this.userModel.findByIdAndDelete(id);

      if (result) {
        logMethod.info(
          {
            userId: id,
            email: result.email,
          },
          'User deleted successfully',
        );
        return true;
      } else {
        logMethod.warn({ userId: id }, 'User not found during delete attempt');
        return false;
      }
    } catch (error) {
      logMethod.error(
        {
          err: error,
          userId: id,
        },
        'Failed to delete user',
      );
      throw error;
    }
  }
}
