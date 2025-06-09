import { z } from 'zod';

// Enum for user roles - assuming ROLES is an array like ['admin', 'editor', 'viewer']
// For Zod enum, we need to provide at least one value, and then more.
// If ROLES is imported from types.ts, ensure it's compatible or define it here.
// For now, using the existing UserRole definition.
export const UserRole = z.enum(['admin', 'editor', 'viewer']);
export type UserRoleType = z.infer<typeof UserRole>; // Exporting the type for use in search query

// --- Core User Schemas ---

// Schema for user creation
export const createUserSchema = z.object({
  email: z.string().email("Invalid email format").nonempty("Email is required"),
  name: z.string().optional(),
  password: z.string().min(8, "Password must be at least 8 characters long").nonempty("Password is required"),
  role: UserRole.optional().default('viewer'),
});

// Schema for user update - Password should not be updated here
export const updateUserSchema = z.object({
  email: z.string().email("Invalid email format").optional(),
  name: z.string().optional(),
  role: UserRole.optional(),
});

// Schema for user ID parameter
export const userIdParamSchema = z.object({
  id: z.string().regex(/^[0-9a-fA-F]{24}$/, 'Invalid MongoDB ObjectId'),
});

// --- Response Schemas ---

// Base user response schema - NO PASSWORD HERE
export const userResponseSchemaBase = z.object({
  id: z.string(),
  email: z.string().email(),
  name: z.string().nullable().optional(),
  role: UserRole,
  createdAt: z.date(),
  updatedAt: z.date(),
  isDeleted: z.boolean().optional(), // Optional as it might not always be returned unless requested
  deletedAt: z.date().nullable().optional(), // Optional and nullable
});

// Full user response schema (inherits from base)
// Currently identical to base, but can be extended if needed.
export const userResponseSchema = userResponseSchemaBase;

// --- Query Parameter Schemas for Get All Users ---

export const paginationQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1).optional(),
  limit: z.coerce.number().int().min(1).max(100).default(10).optional(),
});

export const sortQuerySchema = z.object({
  sortBy: z.enum(['name', 'email', 'role', 'createdAt', 'updatedAt', 'isDeleted']).default('createdAt').optional(),
  sortOrder: z.enum(['asc', 'desc']).default('desc').optional(),
});

export const searchQuerySchema = z.object({
  search: z.string().optional(), // Renamed from searchQuery for brevity
  role: UserRole.optional(), // Renamed from filterRole, using the UserRole enum directly
  isDeleted: z.coerce.boolean().default(false).optional(), // Renamed from filterIsDeleted
});

// Combined schema for querying users
export const getAllUsersQuerySchema = paginationQuerySchema
  .merge(sortQuerySchema)
  .merge(searchQuerySchema);

// Schema for a paginated list of users
export const paginatedUsersResponseSchema = z.object({
  users: z.array(userResponseSchema),
  totalUsers: z.number().int(),
  totalPages: z.number().int(),
  currentPage: z.number().int(),
  limit: z.number().int(),
});

// --- Export Inferred Types ---
export type CreateUserInput = z.infer<typeof createUserSchema>;
export type UpdateUserInput = z.infer<typeof updateUserSchema>;
export type UserIdParamInput = z.infer<typeof userIdParamSchema>;

export type UserResponseBaseType = z.infer<typeof userResponseSchemaBase>;
export type UserResponseType = z.infer<typeof userResponseSchema>;

export type PaginationQueryType = z.infer<typeof paginationQuerySchema>;
export type SortQueryType = z.infer<typeof sortQuerySchema>;
export type SearchQueryType = z.infer<typeof searchQuerySchema>;
export type GetAllUsersQueryType = z.infer<typeof getAllUsersQuerySchema>;

export type PaginatedUsersResponseType = z.infer<typeof paginatedUsersResponseSchema>;

// Old usersResponseSchema (array of users) is replaced by paginatedUsersResponseSchema
// If a simple array response is still needed elsewhere, it can be re-added or kept.
// For now, assuming getAllUsers will use pagination.
// export const usersResponseSchema = z.array(userResponseSchema);
// export type UsersResponse = z.infer<typeof usersResponseSchema>;
