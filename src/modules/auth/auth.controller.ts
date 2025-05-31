// src/modules/auth/auth.controller.ts
import { FastifyReply, FastifyRequest } from 'fastify';
import { AuthService } from './auth.service';
import { config, getCookieConfig } from '../../config'; // Import config for FRONTEND_URL
import { ExternalServiceError, isAppError } from '../../utils/errors';

export class AuthController {
  constructor(private authService: AuthService) {}

  // Handler for the /api/auth/google/callback route
  async googleCallbackHandler(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    const fastify = request.server; // Get Fastify instance

    try {
      // 1. Use the @fastify/oauth2 plugin to exchange the code for a token
      // The plugin handles the POST request to Google's token endpoint
      const tokenData =
        await fastify.googleOAuth2?.getAccessTokenFromAuthorizationCodeFlow(request);

      if (!tokenData) {
        return reply.status(503).send({
          statusCode: 503,
          error: 'Service Unavailable',
          message: 'OAuth2 service is not available.',
        });
      }

      fastify.log.info('Received Google access token.');

      // 2. Fetch user profile from Google using the token access_token
      const accessToken = tokenData.token.access_token;
      const userInfoResponse = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      });

      // Check if the response was successful
      if (!userInfoResponse.ok) {
        const errorData = await userInfoResponse.text();
        throw new ExternalServiceError(
          `Failed to fetch Google user profile: ${errorData}`,
          'GOOGLE_PROFILE_FETCH_ERROR',
        );
      }

      const userProfile = await userInfoResponse.json();
      fastify.log.info({ googleProfile: userProfile }, 'Fetched Google user profile.');

      // 3. Process login (find/create user, generate JWT) using the AuthService
      const { accessToken: jwtToken, refreshToken } =
        await this.authService.processGoogleLogin(userProfile);

      // 4. Set ONLY the access token in an HTTP-only cookie
      // Refresh token is stored in database, not sent to client
      reply.setCookie('auth_token', jwtToken, getCookieConfig());

      fastify.log.info(
        {
          hasAccessToken: !!jwtToken,
          refreshTokenStored: !!refreshToken, // Just log that it exists, don't expose it
          accessTokenExpiry: '1h',
        },
        'Authentication tokens created - access token in cookie, refresh token in database',
      );

      // Redirect user back to the frontend without including the token in the URL
      const redirectUrl = new URL(config.FRONTEND_URL);
      reply.redirect(redirectUrl.toString());
    } catch (error: unknown) {
      fastify.log.error({ err: error }, 'Google OAuth callback error');

      // Prepare error details for the redirect
      let errorCode = 'google_auth_failed';
      let errorDescription = 'An unknown error occurred during Google Sign-In.';

      // Extract appropriate error information
      if (isAppError(error)) {
        errorCode = error.errorCode.toLowerCase();
        errorDescription = error.message;
      } else if (error instanceof Error) {
        errorDescription = error.message;
      }

      // Redirect to frontend with error information
      const errorRedirectUrl = new URL(config.FRONTEND_URL);
      errorRedirectUrl.searchParams.set('error', errorCode);
      errorRedirectUrl.searchParams.set('error_description', errorDescription);
      reply.redirect(errorRedirectUrl.toString());
    }
  }

  // Logout handler
  async logoutHandler(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    try {
      // Try to get refresh token from request body or headers
      const body = request.body as any;
      const refreshToken = body?.refreshToken || request.headers['x-refresh-token'];

      if (refreshToken) {
        // Revoke the refresh token from database
        await this.authService.logout(refreshToken, request);
      }

      // Clear the access token cookie (no more refresh token cookie)
      reply.clearCookie('auth_token', getCookieConfig());

      reply.send({ message: 'Logged out successfully' });
    } catch (error) {
      request.log.error({ err: error }, 'Logout failed');
      // Even if logout fails, clear the cookie
      reply.clearCookie('auth_token', getCookieConfig());
      reply.send({ message: 'Logged out successfully' });
    }
  }

  // Logout from all devices handler
  async logoutAllDevicesHandler(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    try {
      const user = request.user;
      if (!user?.id) {
        reply.status(401).send({ error: 'Not authenticated' });
        return;
      }

      // Revoke all refresh tokens for this user
      await this.authService.logoutAllDevices(user.id, request);

      // Clear the access token cookie
      reply.clearCookie('auth_token', getCookieConfig());

      reply.send({ message: 'Logged out from all devices successfully' });
    } catch (error) {
      request.log.error({ err: error }, 'Logout from all devices failed');
      reply.status(500).send({ error: 'Logout from all devices failed' });
    }
  }

  // Get active sessions handler
  async getActiveSessionsHandler(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    try {
      const user = request.user;
      if (!user?.id) {
        reply.status(401).send({ error: 'Not authenticated' });
        return;
      }

      // Get all active sessions for the user
      const sessions = await this.authService.getUserSessions(user.id, request);

      reply.send({
        sessions,
        currentSessionId: request.sessionId, // Include current session ID
      });
    } catch (error) {
      request.log.error({ err: error }, 'Failed to get active sessions');
      reply.status(500).send({ error: 'Failed to retrieve sessions' });
    }
  }

  // Refresh token handler
  async refreshTokenHandler(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    const fastify = request.server;
    try {
      // Get refresh token from request body or headers (NOT from cookies)
      const body = request.body as any;
      const refreshToken = body?.refreshToken || request.headers['x-refresh-token'];

      if (!refreshToken) {
        return reply.status(401).send({
          statusCode: 401,
          error: 'Unauthorized',
          message: 'Refresh token is required.',
        });
      }

      // Generate new access token using database-stored refresh token
      const newAccessToken = await this.authService.refreshAccessToken(refreshToken, request);

      // Set ONLY the new access token in HTTP-only cookie
      // Refresh token remains in database unchanged
      reply.setCookie('auth_token', newAccessToken, getCookieConfig());

      reply.send({
        message: 'Token refreshed successfully',
        // Note: We don't return the access token in response for security
        // It's automatically stored in HTTP-only cookie
      });
    } catch (error) {
      fastify.log.error({ err: error }, 'Token refresh error');
      reply.status(401).send({
        statusCode: 401,
        error: 'Unauthorized',
        message: 'Invalid or expired refresh token - please login again.',
      });
    }
  }
}
