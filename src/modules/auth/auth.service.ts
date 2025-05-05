// src/modules/auth/auth.service.ts
import { FastifyInstance } from 'fastify';
import { User } from '../user/types'; // Import User interface
import { UserService } from '../user/user.service'; // Import UserService
import { UserJWTPayload } from '../../plugins/jwt'; // Import JWT payload type

export class AuthService {
  // Inject dependencies (Fastify instance for JWT signing, UserService)
  constructor(
    private fastify: FastifyInstance,
    private userService: UserService
  ) {}

  /**
   * Handles the Google OAuth callback. Finds or creates the user
   * and generates a JWT.
   * @param googleAccessToken - The access token obtained from Google.
   * @returns The generated JWT.
   * @throws Error if user profile cannot be fetched or user creation fails.
   */
  async handleGoogleCallback(googleAccessToken: string): Promise<string> {
    try {
      // 1. Fetch user profile from Google using the access token
      // The @fastify/oauth2 plugin often does this automatically or provides a helper
      // Here we assume we get the profile data directly or need to fetch it.
      // Let's use the plugin's built-in mechanism if available.
      // NOTE: @fastify/oauth2 typically provides user info via `request.user`
      // or requires a separate call using the token. Check plugin docs.
      // For this example, let's assume we need to fetch it manually (less ideal).

      // **Alternative using plugin's built-in fetch:**
      // The plugin might provide a method like `fastify.googleOAuth2.getAccessTokenFromAuthorizationCodeFlow`
      // and then `fastify.googleOAuth2.userinfo(token)`
      // Let's assume the controller passes the fetched profile directly for simplicity here.

      // This part is usually handled *within* the callback route handler using
      // the token provided by @fastify/oauth2. See auth.controller.ts.
      // This service method should ideally receive the *profile*, not the token.

      throw new Error("AuthService.handleGoogleCallback should receive profile data, not access token directly. See controller.");

    } catch (error) {
      this.fastify.log.error('Error handling Google callback in service:', error);
      throw new Error('Failed to process Google login.');
    }
  }

   /**
   * Processes Google user profile, finds/creates user, and generates JWT.
   * (This is the method the controller should call)
   * @param googleProfile - User profile data from Google.
   * @returns The generated JWT.
   */
  async processGoogleLogin(googleProfile: any): Promise<string> {
     try {
        // Log the profile data to help debug
        this.fastify.log.info({ googleProfile }, 'Processing Google profile');
        
        // Check if sub exists in the profile - this is the Google ID
        if (!googleProfile.sub) {
           throw new Error('Google profile ID is missing.');
        }
        
        // 2. Find or create user in the database using the original Google profile
        // The UserService should be able to handle the standard OpenID Connect profile format
        const user = await this.userService.findOrCreateUserByGoogleProfile(googleProfile);

        // 3. Prepare JWT payload
        const payload: UserJWTPayload = {
            id: user.id,
            email: user.email,
            // Add other claims as needed
        };

        // 4. Generate JWT
        const token = await this.fastify.jwt.sign(payload);

        return token;

     } catch (error) {
        this.fastify.log.error('Error processing Google login:', error);
        // Log specific error if possible (e.g., DB error)
        if (error instanceof Error) {
             throw new Error(`Google login processing failed: ${error.message}`);
        }
        throw new Error('An unexpected error occurred during Google login.');
     }
  }

  // Add other auth methods like logout, refresh token handling, etc.
}




