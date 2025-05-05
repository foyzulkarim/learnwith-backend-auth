// src/modules/auth/auth.controller.ts
import { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
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
  async googleCallbackHandler(request: FastifyRequest<{ Querystring: GoogleCallbackQuery }>, reply: FastifyReply) {
    const fastify = request.server; // Get Fastify instance

    try {
      // 1. Use the @fastify/oauth2 plugin to exchange the code for a token
      // The plugin handles the POST request to Google's token endpoint
      const tokenData = await fastify.googleOAuth2.getAccessTokenFromAuthorizationCodeFlow(request);
      // tokenData typically includes access_token, refresh_token (if requested), expires_in, scope, token_type

      fastify.log.info('Received Google access token.');

      // 2. Fetch user profile from Google using the access token
      // The plugin often provides a helper for this
      const userProfile = await fastify.googleOAuth2.userinfo(
        tokenData.token.access_token // Access the token property which contains access_token
        // { // Optional parameters if needed by the userinfo endpoint
        //   params: { fields: 'id,email,name,picture' }
        // }
      );
      // userProfile structure depends on Google API response and requested scopes

      fastify.log.info({ googleProfile: userProfile }, 'Fetched Google user profile.');


      // 3. Process login (find/create user, generate JWT) using the AuthService
      const jwtToken = await this.authService.processGoogleLogin(userProfile);

      // 4. Redirect user back to the frontend with the JWT
      // **Security Note:** Passing tokens in URL query parameters is generally
      // discouraged as they can be logged in server logs, browser history, etc.
      // Consider alternative methods for production:
      //    a) Set an HTTP-only cookie containing the JWT.
      //    b) Redirect to a specific frontend page that then makes a POST request
      //       to a secure backend endpoint to *retrieve* the token.
      //    c) Use postMessage API if redirecting within an iframe/popup.
      // For simplicity in this example, we use a query parameter.
      const redirectUrl = new URL(config.FRONTEND_URL); // Use configured frontend URL
      redirectUrl.searchParams.set('token', jwtToken);
      // Optionally add state parameter back if needed for frontend logic
      // redirectUrl.searchParams.set('state', request.query.state || '');

      reply.redirect(redirectUrl.toString());

    } catch (error: any) {
      fastify.log.error({ err: error }, 'Google OAuth callback error');
      // Redirect to frontend with error information
      const errorRedirectUrl = new URL(config.FRONTEND_URL);
      errorRedirectUrl.searchParams.set('error', 'google_auth_failed');
      errorRedirectUrl.searchParams.set('error_description', error.message || 'An unknown error occurred during Google Sign-In.');
      reply.redirect(errorRedirectUrl.toString());
    }
  }

  // Add other controller methods (e.g., for initiating password reset, etc.)
}
