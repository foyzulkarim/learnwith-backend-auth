// src/modules/user/user.route.ts
import { FastifyInstance } from 'fastify';
import { UserService } from './user.service';
import { UserController } from './user.controller';
import { updateProfileSchema } from './user.schema';
import { createLogger } from '../../utils/logger';
import { authenticate } from '../../utils/authMiddleware';

/**
 * User routes plugin
 * @param fastify - The Fastify instance
 */
export default async function userRoutes(fastify: FastifyInstance): Promise<void> {
  // Create service and controller instances
  const userService = new UserService(fastify);
  const logger = createLogger(fastify);
  const userController = new UserController(userService, logger);
  
  // Middleware to check authentication
  const authPreHandler = async (request: any, reply: any) => {
    await authenticate(request, reply);
  };

  // GET /api/user/profile - Get the current user's profile
  fastify.get(
    '/profile',
    {
      preHandler: [authPreHandler],
    },
    async (request, reply) => {
      const userId = request.user?.id;
      
      if (!userId) {
        return reply.status(401).send({ error: 'Unauthorized' });
      }
      
      const user = await userService.findUserById(userId);
      
      if (!user) {
        return reply.status(404).send({ error: 'User not found' });
      }
      
      return reply.status(200).send(user);
    },
  );

  // PUT /api/user/profile - Update the current user's profile
  fastify.put(
    '/profile',
    {
      preHandler: [authPreHandler],
      schema: updateProfileSchema,
    },
    userController.updateProfile,
  );
}