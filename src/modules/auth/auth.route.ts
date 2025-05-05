// src/modules/auth/auth.route.ts
import { FastifyInstance } from 'fastify';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { UserService } from '../user/user.service'; // Import UserService

export default async function authRoutes(fastify: FastifyInstance): Promise<void> {
  // Instantiate services (using Prisma client from Fastify instance)
  // Ensure prisma plugin is registered before these routes
  if (!fastify.prisma) {
    throw new Error('Prisma plugin not registered or available.');
  }
  const userService = new UserService(fastify.prisma);
  const authService = new AuthService(fastify, userService); // Pass fastify for JWT

  // Instantiate controller with the service
  const authController = new AuthController(authService);

  // --- Google OAuth Routes ---

  // Route to initiate Google Login (handled by @fastify/oauth2 plugin)
  // GET /api/auth/google
  // This route is automatically created by the plugin at `startRedirectPath`

  // Callback route where Google redirects the user back
  // GET /api/auth/google/callback
  fastify.get(
    '/google/callback',
    // { schema: authSchemas.googleCallbackSchema }, // Optional: Add Zod schema validation for query params
    authController.googleCallbackHandler.bind(authController), // Bind controller context
  );

  // --- Example Protected Route ---
  // Example route demonstrating JWT authentication check
  fastify.get('/me', { preHandler: [fastify.authenticate] }, async (request, reply) => {
    // Access authenticated user data via request.jwt.user
    const userData = request.jwt.user;
    // Fetch full user profile if needed (avoid including sensitive data in JWT)
    const fullUser = await userService.findUserById(userData.id); // Assuming findUserById exists
    if (!fullUser) {
      return reply.code(404).send({ message: 'User not found' });
    }
    // Return non-sensitive user info
    return { id: fullUser.id, email: fullUser.email, name: fullUser.name };
  });

  fastify.log.info('Auth routes registered');
}
