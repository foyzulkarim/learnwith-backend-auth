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

  // --- Example Protected Routes ---
  // Example route demonstrating JWT authentication check with user data
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

  // Test route to verify cookie-based authentication
  fastify.get('/protected', { preHandler: [fastify.authenticate] }, async (request) => {
    // If we get here, authentication via either cookie or Authorization header was successful
    return {
      message: 'Authentication successful!',
      userId: request.jwt.user.id,
      email: request.jwt.user.email,
    };
  });

  // Route to refresh the token
  fastify.post('/refresh', async (request, reply) => {
    // Extract the refresh token from the cookie
    const refreshToken = request.cookies.refresh_token;

    if (!refreshToken) {
      return reply.code(401).send({ message: 'Refresh token not found' });
    }

    try {
      // Verify and refresh the token
      const newTokens = await authService.refreshToken(refreshToken);

      // Set the new tokens in cookies
      reply.setCookie('auth_token', newTokens.accessToken, {
        path: '/',
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
      });

      // Also set the new refresh token cookie
      reply.setCookie('refresh_token', newTokens.refreshToken, {
        path: '/',
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
      });

      return { message: 'Token refreshed successfully' };
    } catch (err) {
      fastify.log.error('Token refresh error:', err);
      return reply.code(401).send({ message: 'Invalid refresh token' });
    }
  });

  // Logout route to clear the auth_token cookie
  fastify.post('/logout', authController.logoutHandler.bind(authController));

  fastify.log.info('Auth routes registered');
}
