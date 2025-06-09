import { FastifyRequest, FastifyReply } from 'fastify';
import { UserService } from './user.service';
import {
  // CreateUserInput, // Removed as createUserHandler is deleted
  UpdateUserInput,
  UserIdParamInput as UserIdParam,
  GetAllUsersQueryType, // For typing request.query
  PaginatedUsersResponseType, // For typing the response of getAllUsers
  UserResponseType, // For typing the response of deleteUser
} from './user.schema';
import { NotFoundError, ValidationError, DatabaseError } from '../../utils/errors';
// User type for responses is implicitly handled by UserResponseType, PaginatedUsersResponseType etc.

export class UserController {
  constructor(private userService: UserService) {}

  /**
   * Handles request to get all users with pagination, sorting, and filtering.
   */
  async getAllUsersHandler(
    request: FastifyRequest<{ Querystring: GetAllUsersQueryType }>, // Updated request type
    reply: FastifyReply,
  ): Promise<void> {
    try {
      // request.query is validated and typed by Fastify based on schema in user.route.ts
      const paginatedResult = await this.userService.getAllUsers(request.query);
      reply.code(200).send(paginatedResult);
    } catch (error) {
      // Log the error if necessary, or rely on a global error handler
      // request.log.error(error, 'Error in getAllUsersHandler');
      reply.code(500).send({ message: 'Error retrieving users.' });
    }
  }

  /**
   * Handles request to get a single user by their ID.
   * (Defaults to not including soft-deleted users)
   */
  async getUserByIdHandler(
    request: FastifyRequest<{ Params: UserIdParam }>,
    reply: FastifyReply,
  ): Promise<void> {
    try {
      // Calling service method which defaults to not including deleted users
      const user = await this.userService.getUserById(request.params.id);
      if (user) {
        reply.code(200).send(user);
      } else {
        reply.code(404).send({ message: 'User not found.' });
      }
    } catch (error) {
      if (error instanceof ValidationError) {
        reply.code(400).send({ message: error.message, errorCode: error.errorCode });
      } else if (error instanceof DatabaseError) {
        reply.code(500).send({ message: 'Database error retrieving user.' });
      } else {
        reply.code(500).send({ message: 'An unexpected error occurred retrieving user.' });
      }
    }
  }

  /**
   * Handles request to update an existing user.
   */
  async updateUserHandler(
    request: FastifyRequest<{ Body: UpdateUserInput; Params: UserIdParam }>,
    reply: FastifyReply,
  ): Promise<void> {
    try {
      const user = await this.userService.updateUser(request.params.id, request.body);
      reply.code(200).send(user);
    } catch (error) {
      if (error instanceof NotFoundError) {
        reply.code(404).send({ message: error.message });
      } else if (error instanceof ValidationError) {
        reply.code(409).send({ message: error.message, errorCode: error.errorCode });
      } else if (error instanceof DatabaseError) {
        reply.code(500).send({ message: 'Database error updating user.' });
      } else {
        reply.code(500).send({ message: 'An unexpected error occurred updating user.' });
      }
    }
  }

  /**
   * Handles request to soft delete a user by their ID.
   * Returns the soft-deleted user object.
   */
  async deleteUserHandler(
    request: FastifyRequest<{ Params: UserIdParam }>,
    reply: FastifyReply,
  ): Promise<void> {
    try {
      // UserService.deleteUser now returns the soft-deleted user
      const user = await this.userService.deleteUser(request.params.id);
      reply.code(200).send(user); // Send the updated user object as confirmation
    } catch (error) {
      if (error instanceof NotFoundError) {
        reply.code(404).send({ message: error.message });
      } else if (error instanceof DatabaseError) {
        reply.code(500).send({ message: 'Database error deleting user.' });
      } else {
        reply.code(500).send({ message: 'An unexpected error occurred deleting user.' });
      }
    }
  }

  /**
   * Handles request to restore a soft-deleted user by their ID.
   * Returns the restored user object.
   */
  async restoreUserHandler(
    request: FastifyRequest<{ Params: UserIdParam }>,
    reply: FastifyReply,
  ): Promise<void> {
    try {
      const user = await this.userService.restoreUser(request.params.id);
      // request.log.info(`User restored successfully: ${user.id}`); // Example of logging
      reply.code(200).send(user);
    } catch (error) {
      if (error instanceof NotFoundError) {
        // This covers cases where the user is not found, or found but not in a soft-deleted state.
        reply.code(404).send({ message: error.message });
      } else if (error instanceof DatabaseError) {
        reply.code(500).send({ message: 'Database error restoring user.' });
      } else {
        // request.log.error(error, 'Unexpected error in restoreUserHandler'); // Example of logging
        reply.code(500).send({ message: 'An unexpected error occurred restoring user.' });
      }
    }
  }
}

// Instantiation and registration are handled in user.route.ts and app.ts
// No changes needed here for that.
// Controller remains focused on handling request/response logic and delegating to service.
