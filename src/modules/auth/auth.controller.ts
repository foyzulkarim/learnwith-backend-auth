// src/modules/auth/auth.controller.ts
import { FastifyReply, FastifyRequest } from 'fastify';
import { AuthService } from './auth.service';
import { config, getCookieConfig } from '../../config'; // Import config for FRONTEND_URL
import { ExternalServiceError, isAppError } from '../../utils/errors';

export class AuthController {
  constructor(private authService: AuthService) {}

  // Handler for the /api/auth/google/callback route
  async googleCallbackHandler(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    request.log.info('[AuthController] Google OAuth callback started.');
    const fastify = request.server; // Get Fastify instance

    try {
      // 1. Use the @fastify/oauth2 plugin to exchange the code for a token
      // The plugin handles the POST request to Google's token endpoint
      request.log.info('[AuthController] Attempting to exchange authorization code for token.');
      const tokenData =
        await fastify.googleOAuth2?.getAccessTokenFromAuthorizationCodeFlow(request);

      if (!tokenData) {
        request.log.warn('[AuthController] OAuth2 service unavailable or failed to get token data.');
        return reply.status(503).send({
          statusCode: 503,
          error: 'Service Unavailable',
          message: 'OAuth2 service is not available.',
        });
      }

      request.log.info({ tokenId: tokenData.token.id_token ? 'present' : 'absent' }, '[AuthController] Successfully exchanged code for Google access token.');

      // 2. Fetch user profile from Google using the token access_token
      const accessToken = tokenData.token.access_token;
      request.log.info('[AuthController] Fetching user profile from Google.');
      const userInfoResponse = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      });

      // Check if the response was successful
      if (!userInfoResponse.ok) {
        const errorData = await userInfoResponse.text();
        request.log.error({ errorData }, '[AuthController] Failed to fetch Google user profile.');
        throw new ExternalServiceError(
          `Failed to fetch Google user profile: ${errorData}`,
          'GOOGLE_PROFILE_FETCH_ERROR',
        );
      }

      const userProfile = await userInfoResponse.json();
      request.log.info({ userId: userProfile.sub }, '[AuthController] Successfully fetched Google user profile.');

      // 3. Process login (find/create user, generate JWT) using the AuthService
      request.log.info({ userId: userProfile.sub }, '[AuthController] Processing Google login.');
      const { accessToken: jwtToken, refreshToken } =
        await this.authService.processGoogleLogin(userProfile);
      request.log.info({ userId: userProfile.sub }, '[AuthController] Successfully processed Google login, JWTs generated.');

      // 4. Set the JWT token in an HTTP-only cookie using our consistent configuration
      reply.setCookie('auth_token', jwtToken, getCookieConfig());
      request.log.debug('[AuthController] Auth token cookie set.');

      // Also set the refresh token in a separate cookie
      reply.setCookie('refresh_token', refreshToken, getCookieConfig());
      request.log.debug('[AuthController] Refresh token cookie set.');

      // Redirect user back to the frontend without including the token in the URL
      const redirectUrl = new URL(config.FRONTEND_URL);
      request.log.info(`[AuthController] Redirecting to frontend: ${redirectUrl.toString()}`);
      reply.redirect(redirectUrl.toString());
    } catch (error: unknown) {
      request.log.error({ err: error }, '[AuthController] Google OAuth callback error');

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
    request.log.info('[AuthController] Logout process started.');
    reply.clearCookie('auth_token', getCookieConfig());
    reply.clearCookie('refresh_token', getCookieConfig());
    request.log.info('[AuthController] Auth and refresh cookies cleared. Logout successful.');
    reply.send({ message: 'Logged out successfully' });
  }

  // Refresh token handler
  async refreshTokenHandler(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    request.log.info('[AuthController] Token refresh process started.');
    try {
      // Extract refresh token from cookie
      const refreshToken = request.cookies.refresh_token;
      if (!refreshToken) {
        request.log.warn('[AuthController] Refresh token missing in request cookies.');
        return reply.status(401).send({
          statusCode: 401,
          error: 'Unauthorized',
          message: 'Refresh token is missing.',
        });
      }
      request.log.info('[AuthController] Refresh token found, attempting to verify and issue new tokens.');

      // Verify refresh token and get new tokens
      const { accessToken, refreshToken: newRefreshToken } =
        await this.authService.refreshToken(refreshToken);
      request.log.info('[AuthController] Successfully verified refresh token and generated new tokens.');

      // Set the new JWT token in HTTP-only cookie
      reply.setCookie('auth_token', accessToken, getCookieConfig());
      request.log.debug('[AuthController] New auth token cookie set.');

      // Set the new refresh token in HTTP-only cookie
      reply.setCookie('refresh_token', newRefreshToken, getCookieConfig());
      request.log.debug('[AuthController] New refresh token cookie set.');

      request.log.info('[AuthController] Token refresh process completed successfully.');
      reply.send({ message: 'Token refreshed successfully' });
    } catch (error) {
      request.log.error({ err: error }, '[AuthController] Token refresh error');
      reply.status(401).send({
        statusCode: 401,
        error: 'Unauthorized',
        message: 'Invalid or expired refresh token.',
      });
    }
  }
}
