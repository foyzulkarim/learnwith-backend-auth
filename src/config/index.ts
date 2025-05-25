// src/config/index.ts
import dotenv from 'dotenv';
import path from 'path';
import { envSchema } from './schema'; // Import the Zod schema
import { z } from 'zod';

// Define the config type
export type AppConfig = z.infer<typeof envSchema>;

// Determine the environment (default to development if not set)
const nodeEnv = process.env.NODE_ENV || 'development';

// Load environment variables from the appropriate .env file
// Typically .env for development, potentially others for test/prod if needed
const envPath = path.resolve(process.cwd(), `.env`); // Load .env from project root

// Load environment variables using dotenv
const result = dotenv.config({ path: envPath });

if (result.error && nodeEnv !== 'production') {
  // Allow missing .env in production if variables are set via the environment
  // eslint-disable-next-line no-console
  console.warn(`Warning: Could not load .env file from ${envPath}:`, result.error.message);
}

// Parse and validate the config
let config: AppConfig;

try {
  config = envSchema.parse(process.env);
  // eslint-disable-next-line no-console
  console.log('Configuration loaded successfully.');
} catch (error) {
  // eslint-disable-next-line no-console
  console.error('❌ Invalid environment variables:', error);
  // Exit the process if validation fails, as the app cannot run correctly
  process.exit(1);
}

// Utility to check if environment is production
export const isProd = config.NODE_ENV === 'production';
export const isDev = config.NODE_ENV === 'development';
export const isTest = config.NODE_ENV === 'test';

// Public routes that don't require authentication
// These can be overridden per environment if needed
export const publicRoutes: string[] = [
  '/api/auth/login',
  '/api/auth/register',
  '/api/auth/google',
  '/api/auth/google/callback',
  '/api/auth/refresh',
  '/health', // Additional health check endpoint
  '/api/docs', // API documentation (if enabled)
];

// Standard cookie configuration to ensure consistency
export interface CookieOptions {
  path?: string;
  domain?: string;
  maxAge?: number;
  signed?: boolean;
  expires?: Date;
  httpOnly?: boolean;
  secure?: boolean;
  sameSite?: 'strict' | 'lax' | 'none';
}

// Helper function to get consistent cookie configuration
export function getCookieConfig(options: Partial<CookieOptions> = {}): CookieOptions {
  return {
    path: '/',
    httpOnly: true,
    secure: isProd, // Only secure in production
    sameSite: isProd ? 'none' : config.COOKIE_SAME_SITE, // Use 'none' in production for cross-site scenarios
    maxAge: 604800000, // Default to 7 days in milliseconds (same as refresh token)
    ...options,
  };
}

// Export the validated config
export { config };
