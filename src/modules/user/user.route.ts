import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { UserController } from './user.controller';
import { UserService } from './user.service';
import {
  createUserSchema,
  updateUserSchema,
  userIdParamSchema,
  userResponseSchema,
  usersResponseSchema,
  UserResponse, // For response type in delete
} from './user.schema';
import { authenticate, authorizeRoles } from '../../utils/authMiddleware';
import { Role } from './types'; // Import Role for authorizeRoles

// Define a simple response schema for delete operations
const deleteResponseSchema = {
  type: 'object',
  properties: {
    success: { type: 'boolean' },
    message: { type: 'string' },
    userId: { type: 'string' },
  },
};

export async function userRoutes(fastify: FastifyInstance) {
  // Instantiate service and controller
  // UserService requires FastifyInstance for logging and potentially other plugins
  const userService = new UserService(fastify);
  const userController = new UserController(userService);

  // Common preHandlers for admin routes
  const adminPreHandlers = [
    authenticate, // Ensures user is logged in
    authorizeRoles('admin' as Role), // Ensures user has 'admin' role
    // Note: We cast 'admin' to Role here if your Role enum/type doesn't directly match string literals
    // or if authorizeRoles expects a more specific type.
    // Ensure Role enum from './types' includes 'admin'.
  ];

  // Create User
  fastify.post(
    '/users',
    {
      schema: {
        description: 'Create a new user. Requires admin privileges.',
        tags: ['Admin Users'],
        summary: 'Create User',
        body: createUserSchema,
        response: {
          201: userResponseSchema,
          // Add other error responses as needed
        },
      },
      preHandler: adminPreHandlers,
    },
    userController.createUserHandler.bind(userController),
  );

  // Get All Users
  fastify.get(
    '/users',
    {
      schema: {
        description: 'Get a list of all users. Requires admin privileges.',
        tags: ['Admin Users'],
        summary: 'List All Users',
        response: {
          200: usersResponseSchema,
        },
      },
      preHandler: adminPreHandlers,
    },
    userController.getAllUsersHandler.bind(userController),
  );

  // Get User by ID
  fastify.get(
    '/users/:id',
    {
      schema: {
        description: 'Get a single user by their ID. Requires admin privileges.',
        tags: ['Admin Users'],
        summary: 'Get User by ID',
        params: userIdParamSchema,
        response: {
          200: userResponseSchema,
          404: { description: 'User not found', type: 'object', properties: { message: { type: 'string' } } },
        },
      },
      preHandler: adminPreHandlers,
    },
    userController.getUserByIdHandler.bind(userController),
  );

  // Update User
  fastify.put(
    '/users/:id',
    {
      schema: {
        description: 'Update an existing user. Requires admin privileges.',
        tags: ['Admin Users'],
        summary: 'Update User',
        params: userIdParamSchema,
        body: updateUserSchema,
        response: {
          200: userResponseSchema,
          404: { description: 'User not found', type: 'object', properties: { message: { type: 'string' } } },
        },
      },
      preHandler: adminPreHandlers,
    },
    userController.updateUserHandler.bind(userController),
  );

  // Delete User
  fastify.delete(
    '/users/:id',
    {
      schema: {
        description: 'Delete a user by their ID. Requires admin privileges.',
        tags: ['Admin Users'],
        summary: 'Delete User',
        params: userIdParamSchema,
        response: {
          200: deleteResponseSchema, // Using the simple success message schema
          404: { description: 'User not found', type: 'object', properties: { message: { type: 'string' } } },
        },
      },
      preHandler: adminPreHandlers,
    },
    userController.deleteUserHandler.bind(userController),
  );
}
