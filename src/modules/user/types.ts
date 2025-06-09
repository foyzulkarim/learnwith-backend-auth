/**
 * Available user roles for role-based access control
 */
export const ROLES = ['admin', 'creator', 'student', 'viewer'] as const;
export type Role = (typeof ROLES)[number];

/**
 * Interface for email preferences
 */
export interface EmailPreferences {
  marketing: boolean;
  coursesUpdates: boolean;
  accountNotifications: boolean;
}

/**
 * Interface that represents the User model
 */
export interface User {
  id: string;
  email: string;
  name: string | null;
  googleId: string | null;
  role: Role;
  bio: string;
  emailPreferences: EmailPreferences;
  createdAt: Date;
  updatedAt: Date;
}
