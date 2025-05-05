// src/modules/user/user.service.ts
import { PrismaClient } from '@prisma/client';
import { User } from './types'; // Import User from our types file

// Define the structure of the Google profile data we expect
// This matches the OpenID Connect format that Google returns
export interface GoogleUserProfile {
  sub?: string; // OpenID Connect standard - Google's unique user ID
  id?: string; // Alternative ID field (for backward compatibility)
  name?: string; // User's full name
  given_name?: string; // User's first name
  family_name?: string; // User's last name
  email?: string; // User's email address
  email_verified?: boolean; // Whether email is verified
  picture?: string; // URL to user's profile picture

  // Legacy format support (for backward compatibility)
  displayName?: string;
  emails?: Array<{ value: string; verified?: boolean }>;
  photos?: Array<{ value: string }>;
  provider?: string;
}

export class UserService {
  constructor(private prisma: PrismaClient) {}

  /**
   * Finds an existing user by their Google ID or email,
   * or creates a new user if one doesn't exist.
   * @param profile - User profile information obtained from Google.
   * @returns The found or created User object.
   */
  async findOrCreateUserByGoogleProfile(profile: GoogleUserProfile): Promise<User> {
    // Get the Google ID (sub is the OpenID Connect standard)
    const googleId = profile.sub || profile.id;
    if (!googleId) {
      throw new Error('Google profile ID is missing.');
    }

    // Get the email (direct email field or from the emails array)
    const email =
      profile.email ||
      (profile.emails && profile.emails.length > 0 ? profile.emails[0].value : undefined);

    if (!email) {
      throw new Error('Google profile email is missing.');
    }

    // Get the name
    const name =
      profile.name ||
      profile.displayName ||
      `${profile.given_name || ''} ${profile.family_name || ''}`.trim() ||
      'User';

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
