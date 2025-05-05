// src/modules/user/user.service.ts
import { FastifyInstance } from 'fastify';
import { PrismaClient } from '@prisma/client';
import { User } from './types'; // Import User from our types file

// Define the structure of the Google profile data we expect
interface GoogleUserProfile {
  id: string; // Google's unique user ID
  displayName?: string; // User's display name
  name?: {
    // Name components
    familyName?: string;
    givenName?: string;
  };
  emails?: Array<{ value: string; verified?: boolean }>; // User's email addresses
  photos?: Array<{ value: string }>; // User's profile picture URLs
  provider: string; // Should be 'google'
  // _raw: string;       // Raw JSON response
  // _json: any;       // Parsed JSON response
}

export class UserService {
  constructor(private prisma: PrismaClient) {}

  /**
   * Finds an existing user by their Google ID or email,
   * or creates a new user if one doesn't exist.
   * @param profile - User profile information obtained from Google.
   * @returns The found or created User object.
   */
  async findOrCreateUserByGoogleProfile(
    profile: GoogleUserProfile
  ): Promise<User> {
    if (!profile.id) {
      throw new Error('Google profile ID is missing.');
    }
    if (
      !profile.emails ||
      profile.emails.length === 0 ||
      !profile.emails[0].value
    ) {
      throw new Error('Google profile email is missing.');
    }

    const googleId = profile.id;
    const email = profile.emails[0].value; // Use the primary email
    const name =
      profile.displayName ||
      `${profile.name?.givenName || ''} ${
        profile.name?.familyName || ''
      }`.trim() ||
      'User'; // Construct name

    // 1. Try to find user by Google ID
    let user = await this.prisma.user.findUnique({
      where: { googleId },
    });

    if (user) {
      // Optional: Update user's name or other details if they've changed in Google
      if (user.name !== name) {
        user = await this.prisma.user.update({
          where: { id: user.id },
          data: { name },
        });
      }
      return user;
    }

    // 2. If not found by Google ID, try to find by email
    // This handles cases where a user might have previously signed up via email
    user = await this.prisma.user.findUnique({
      where: { email },
    });

    if (user) {
      // User exists with this email but hasn't linked Google yet.
      // Link the Google ID to the existing account.
      user = await this.prisma.user.update({
        where: { id: user.id },
        data: {
          googleId: googleId,
          name: user.name || name, // Keep existing name or update if missing
        },
      });
      return user;
    }

    // 3. If not found by email either, create a new user
    user = await this.prisma.user.create({
      data: {
        email: email,
        googleId: googleId,
        name: name,
        // Add other default fields if necessary
      },
    });

    return user;
  }

  // Add other user-related methods here (e.g., findById, updateUser, etc.)
  // Helper in user service (add this to UserService class)
  async findUserById(id: string): Promise<User | null> {
    return this.prisma.user.findUnique({ where: { id } });
  }
}
