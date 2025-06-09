// src/modules/user/user.controller.ts
import { FastifyRequest, FastifyReply } from 'fastify';
import { UserService } from './user.service';
import { UpdateProfileRequest } from './user.request';
import { ValidationError } from '../../utils/errors';
import { Logger } from '../../utils/logger';

export class UserController {
  private userService: UserService;
  private logger: Logger;

  constructor(userService: UserService, logger: Logger) {
    this.userService = userService;
    this.logger = logger;
  }

  /**
   * Update the current user's profile
   */
  updateProfile = async (request: FastifyRequest, reply: FastifyReply) => {
    const startTime = Date.now();
    const userId = request.user?.id;
    const profileData = request.body as UpdateProfileRequest;

    request.log.info(
      {
        operation: 'updateProfile',
        userId,
        updateFields: Object.keys(profileData),
        requestId: request.id,
      },
      `Updating profile for user ${userId}`
    );

    try {
      if (!userId) {
        return reply.status(401).send({ error: 'Unauthorized' });
      }

      const updatedUser = await this.userService.updateProfile(userId, profileData);
      const duration = Date.now() - startTime;

      if (!updatedUser) {
        request.log.warn(
          {
            operation: 'updateProfile',
            userId,
            found: false,
            duration,
            requestId: request.id,
          },
          `User not found: ${userId}`
        );

        return reply.status(404).send({ error: 'User not found' });
      }

      // Log success information
      request.log.info(
        {
          operation: 'updateProfile',
          success: true,
          userId,
          duration,
          updatedFields: Object.keys(profileData),
          requestId: request.id,
        },
        `Successfully updated profile for user ${userId} in ${duration}ms`
      );

      return reply.status(200).send(updatedUser);
    } catch (error) {
      const duration = Date.now() - startTime;

      if (error instanceof ValidationError) {
        request.log.warn(
          {
            operation: 'updateProfile',
            userId,
            duration,
            error: error.message,
            errorCode: error instanceof ValidationError ? error.errorCode : undefined,
            requestId: request.id,
          },
          `Validation error during profile update: ${error.message}`
        );

        return reply.status(400).send({ 
          error: error.message,
          code: error instanceof ValidationError ? error.errorCode : 'VALIDATION_ERROR'
        });
      }

      // Log unexpected errors
      request.log.error(
        {
          operation: 'updateProfile',
          userId,
          success: false,
          duration,
          error: error instanceof Error ? error.message : 'Unknown error',
          errorType: error?.constructor?.name,
          requestId: request.id,
        },
        `Failed to update profile for user: ${userId}`
      );

      return reply.status(500).send({ error: 'Internal Server Error' });
    }
  };
}