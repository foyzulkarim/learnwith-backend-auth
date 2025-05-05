/**
 * Interface that matches the Prisma User model
 */
export interface User {
  id: string;
  email: string;
  name: string | null;
  googleId: string | null;
  createdAt: Date;
  updatedAt: Date;
} 
