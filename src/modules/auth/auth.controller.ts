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
      fastify.log.info(
        {
          userId: userProfile.sub,
          email: userProfile.email,
        },
        'Fetched Google user profile.',
      );

      // 3. Process login (find/create user, generate JWT) using the AuthService
      const { accessToken: jwtToken, refreshToken } =
        await this.authService.processGoogleLogin(userProfile);

      // 4. Set the JWT token in an HTTP-only cookie using our consistent configuration
      reply.setCookie('auth_token', jwtToken, getCookieConfig());

      // Also set the refresh token in a separate cookie
      reply.setCookie('refresh_token', refreshToken, getCookieConfig());

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
    reply.clearCookie('auth_token', getCookieConfig());
    reply.clearCookie('refresh_token', getCookieConfig());
    reply.send({ message: 'Logged out successfully' });
  }

  // Refresh token handler
  async refreshTokenHandler(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    const fastify = request.server;
    try {
      // Extract refresh token from cookie
      const refreshToken = request.cookies.refresh_token;
      if (!refreshToken) {
        return reply.status(401).send({
          statusCode: 401,
          error: 'Unauthorized',
          message: 'Refresh token is missing.',
        });
      }

      // Verify refresh token and get new tokens
      const { accessToken, refreshToken: newRefreshToken } =
        await this.authService.refreshToken(refreshToken);

      // Set the new JWT token in HTTP-only cookie
      reply.setCookie('auth_token', accessToken, getCookieConfig());

      // Set the new refresh token in HTTP-only cookie
      reply.setCookie('refresh_token', newRefreshToken, getCookieConfig());

      reply.send({ message: 'Token refreshed successfully' });
    } catch (error) {
      fastify.log.error({ err: error }, 'Token refresh error');
      reply.status(401).send({
        statusCode: 401,
        error: 'Unauthorized',
        message: 'Invalid or expired refresh token.',
      });
    }
  }
}
