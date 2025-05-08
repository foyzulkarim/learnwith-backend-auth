// src/modules/auth/auth.controller.ts
import { FastifyReply, FastifyRequest } from 'fastify';
import { AuthService } from './auth.service';
import { config } from '../../config'; // Import config for FRONTEND_URL

// Define potential query parameters for the callback
interface GoogleCallbackQuery {
  code?: string; // Authorization code from Google
  error?: string; // Error code if authentication failed
  error_description?: string; // Description of the error
  state?: string; // State parameter for CSRF protection (if used)
}

export class AuthController {
  constructor(private authService: AuthService) {}

  // Handler for the /api/auth/google/callback route
  async googleCallbackHandler(
    request: FastifyRequest<{ Querystring: GoogleCallbackQuery }>,
    reply: FastifyReply,
  ): Promise<void> {
    const fastify = request.server; // Get Fastify instance

    try {
      // 1. Use the @fastify/oauth2 plugin to exchange the code for a token
      // The plugin handles the POST request to Google's token endpoint
      const tokenData = await fastify.googleOAuth2.getAccessTokenFromAuthorizationCodeFlow(request);
      // tokenData typically includes access_token, refresh_token (if requested), expires_in, scope, token_type

      fastify.log.info('Received Google access token.');

      // 2. Fetch user profile from Google using the token access_token
      const accessToken = tokenData.token.access_token;
      const userInfo = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      });

      const userProfile = await userInfo.json();
      fastify.log.info({ googleProfile: userProfile }, 'Fetched Google user profile.');

      // 3. Process login (find/create user, generate JWT) using the AuthService
      const { accessToken: jwtToken, refreshToken } =
        await this.authService.processGoogleLogin(userProfile);

      // 4. Set the JWT token in an HTTP-only cookie
      // This cookie will be checked for authentication in protected routes
      // Even if Authorization header is bypassed, this cookie will be verified
      reply.setCookie('auth_token', jwtToken, {
        httpOnly: true, // Prevent access from JavaScript
        secure: process.env.NODE_ENV === 'production', // Use secure cookies in production
        sameSite: 'lax', // Prevent CSRF in most cases
        path: '/', // Cookie is valid for the entire domain
      });

      // Also set the refresh token in a separate cookie
      reply.setCookie('refresh_token', refreshToken, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        path: '/',
      });

      // Redirect user back to the frontend without including the token in the URL
      const redirectUrl = new URL(config.FRONTEND_URL);
      reply.redirect(redirectUrl.toString());
    } catch (error: unknown) {
      fastify.log.error({ err: error }, 'Google OAuth callback error');
      // Redirect to frontend with error information
      const errorRedirectUrl = new URL(config.FRONTEND_URL);
      errorRedirectUrl.searchParams.set('error', 'google_auth_failed');
      errorRedirectUrl.searchParams.set(
        'error_description',
        error instanceof Error ? error.message : 'An unknown error occurred during Google Sign-In.',
      );
      reply.redirect(errorRedirectUrl.toString());
    }
  }

  // Add other controller methods (e.g., for initiating password reset, etc.)

  async logoutHandler(_request: FastifyRequest, reply: FastifyReply): Promise<void> {
    reply.clearCookie('auth_token', {
      path: '/',
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
    });

    // Also clear the refresh token cookie
    reply.clearCookie('refresh_token', {
      path: '/',
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
    });

    reply.send({ message: 'Logged out successfully' });
  }
}
