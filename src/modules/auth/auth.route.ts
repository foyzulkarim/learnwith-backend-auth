// src/modules/auth/auth.route.ts
import { FastifyInstance } from 'fastify';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { UserService } from '../user/user.service';
import { NotFoundError, AuthenticationError } from '../../utils/errors';
import { getCookieConfig } from '../../config';

export default async function authRoutes(fastify: FastifyInstance): Promise<void> {
  // Create services
  const userService = new UserService(fastify);
  const authService = new AuthService(fastify, userService);

  // Instantiate controller with the service
  const authController = new AuthController(authService);

  // --- Google OAuth Routes ---

  // Route to initiate Google Login (handled by @fastify/oauth2 plugin)
  // GET /api/auth/google
  // This route is automatically created by the plugin at `startRedirectPath`

  // Callback route where Google redirects the user back
  fastify.get('/google/callback', authController.googleCallbackHandler.bind(authController));

  // --- Example Protected Routes ---
  // Example route demonstrating JWT authentication check with user data
  fastify.get('/me', { preHandler: [fastify.authenticate] }, async (request, _reply) => {
    // Access authenticated user data via request.jwt.user
    const userData = request.jwt.user;
    // Fetch full user profile if needed (avoid including sensitive data in JWT)
    const fullUser = await userService.findUserById(userData.id);
    if (!fullUser) {
      throw new NotFoundError('User not found', 'USER_NOT_FOUND');
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
      throw new AuthenticationError('Refresh token not found', 'MISSING_REFRESH_TOKEN');
    }

    // Verify and refresh the token
    const newTokens = await authService.refreshToken(refreshToken);

    // Set the new tokens in cookies using consistent configuration
    reply.setCookie('auth_token', newTokens.accessToken, getCookieConfig());

    // Also set the new refresh token cookie
    reply.setCookie('refresh_token', newTokens.refreshToken, getCookieConfig());

    return { message: 'Token refreshed successfully' };
  });

  // Logout route to clear the auth_token cookie
  fastify.post('/logout', authController.logoutHandler.bind(authController));

  fastify.log.info('Auth routes registered');
}
