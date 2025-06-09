import { FastifyRequest, FastifyReply } from 'fastify';
import { UserService } from './user.service';
import {
  CreateUserInput,
  UpdateUserInput,
  UserIdParamInput as UserIdParam, // Renaming for clarity as it's used for Params type
} from './user.schema';
import { NotFoundError, ValidationError, DatabaseError } from '../../utils/errors';
import { User } from './types'; // Assuming User type is defined for responses

export class UserController {
  constructor(private userService: UserService) {}

  /**
   * Handles request to create a new user.
   */
  async createUserHandler(
    request: FastifyRequest<{ Body: CreateUserInput }>,
    reply: FastifyReply,
  ): Promise<void> {
    try {
      const user = await this.userService.createUser(request.body);
      reply.code(201).send(user);
    } catch (error) {
      if (error instanceof ValidationError) {
        reply.code(409).send({ message: error.message, errorCode: error.errorCode }); // 409 for duplicate
      } else if (error instanceof DatabaseError) {
        reply.code(500).send({ message: 'Database error creating user.' });
      } else {
        reply.code(500).send({ message: 'An unexpected error occurred.' });
      }
    }
  }

  /**
   * Handles request to get all users.
   */
  async getAllUsersHandler(
    request: FastifyRequest,
    reply: FastifyReply,
  ): Promise<void> {
    try {
      const users = await this.userService.getAllUsers();
      reply.code(200).send(users);
    } catch (error) {
      // Assuming getAllUsers primarily throws DatabaseError or generic errors
      reply.code(500).send({ message: 'Error retrieving users.' });
    }
  }

  /**
   * Handles request to get a single user by their ID.
   */
  async getUserByIdHandler(
    request: FastifyRequest<{ Params: UserIdParam }>,
    reply: FastifyReply,
  ): Promise<void> {
    try {
      const user = await this.userService.getUserById(request.params.id);
      if (user) {
        reply.code(200).send(user);
      } else {
        reply.code(404).send({ message: 'User not found.' });
      }
    } catch (error) {
      if (error instanceof ValidationError) { // For invalid ID format
        reply.code(400).send({ message: error.message, errorCode: error.errorCode });
      } else if (error instanceof DatabaseError) {
        reply.code(500).send({ message: 'Database error retrieving user.' });
      } else {
        reply.code(500).send({ message: 'An unexpected error occurred.' });
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
      } else if (error instanceof ValidationError) { // e.g. duplicate email on update
        reply.code(409).send({ message: error.message, errorCode: error.errorCode });
      } else if (error instanceof DatabaseError) {
        reply.code(500).send({ message: 'Database error updating user.' });
      } else {
        reply.code(500).send({ message: 'An unexpected error occurred.' });
      }
    }
  }

  /**
   * Handles request to delete a user by their ID.
   */
  async deleteUserHandler(
    request: FastifyRequest<{ Params: UserIdParam }>,
    reply: FastifyReply,
  ): Promise<void> {
    try {
      const result = await this.userService.deleteUser(request.params.id);
      // Send 200 with message, or 204 if preferred (though 200 with body is common for delete confirmations)
      reply.code(200).send(result);
    } catch (error) {
      if (error instanceof NotFoundError) {
        reply.code(404).send({ message: error.message });
      } else if (error instanceof DatabaseError) {
        reply.code(500).send({ message: 'Database error deleting user.' });
      } else {
        reply.code(500).send({ message: 'An unexpected error occurred.' });
      }
    }
  }
}

// The instantiation of UserController and UserService will typically be handled
// in the main application setup (e.g., where Fastify instance is created and plugins are registered)
// to allow for proper dependency injection and lifecycle management.
// For now, we export the class. The routing setup will use this controller.
// Example (actual instantiation will be in app.ts or user.route.ts):
//
// import { FastifyInstance } from 'fastify';
// import { UserService } from './user.service';
//
// export function registerUserController(fastify: FastifyInstance) {
//   const userService = new UserService(fastify); // Assuming service needs fastify
//   const userController = new UserController(userService);
//   // then register routes with controller methods
// }
//
// Or, if UserService doesn't need fastify directly:
//
// const userService = new UserService(); // Potentially if UserModel is self-contained
// export const userController = new UserController(userService);
//
// For this subtask, only the class definition is required.
// The routing file will be responsible for instantiating it.
