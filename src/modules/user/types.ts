/**
 * Available user roles for role-based access control
 */
export const ROLES = ['admin', 'creator', 'student', 'viewer'] as const;
export type Role = (typeof ROLES)[number];

/**
 * Interface that represents the User model
 */
export interface User {
  id: string;
  email: string;
  name: string | null;
  googleId: string | null;
  role: Role;
  createdAt: Date;
  updatedAt: Date;
}
