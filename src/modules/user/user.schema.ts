import { z } from 'zod';

// Enum for user roles
export const UserRole = z.enum(['admin', 'editor', 'viewer']);

// Schema for user creation
export const createUserSchema = z.object({
  email: z.string().email().nonempty(),
  name: z.string().optional(),
  password: z.string().min(8).nonempty(),
  role: UserRole.optional().default('viewer'),
});

// Schema for user update
export const updateUserSchema = z.object({
  email: z.string().email().optional(),
  name: z.string().optional(),
  role: UserRole.optional(),
});

// Schema for user ID parameter
export const userIdParamSchema = z.object({
  id: z.string().regex(/^[0-9a-fA-F]{24}$/, 'Invalid MongoDB ObjectId'), // Validate MongoDB ObjectId
});

// Base user response schema
export const userResponseSchemaBase = z.object({
  id: z.string(),
  email: z.string().email(),
  name: z.string().nullable().optional(),
  role: UserRole,
  createdAt: z.date(),
  updatedAt: z.date(),
});

// Full user response schema (inherits from base)
export const userResponseSchema = userResponseSchemaBase;

// Schema for a list of users
export const usersResponseSchema = z.array(userResponseSchema);

// Export types for convenience
export type CreateUserInput = z.infer<typeof createUserSchema>;
export type UpdateUserInput = z.infer<typeof updateUserSchema>;
export type UserIdParamInput = z.infer<typeof userIdParamSchema>;
export type UserResponseBase = z.infer<typeof userResponseSchemaBase>;
export type UserResponse = z.infer<typeof userResponseSchema>;
export type UsersResponse = z.infer<typeof usersResponseSchema>;
