// src/config/schema.ts
import { z } from 'zod';

// Define schema for environment variables
export const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z.coerce.number().default(3000),
  DATABASE_URL: z.string().url(), // Connection string for Prisma (potentially D1 HTTP API endpoint + token)
  JWT_SECRET: z.string().min(32, 'JWT_SECRET must be at least 32 characters long'),
  FRONTEND_URL: z.string().url().default('http://localhost:5173'), // URL of your frontend app

  // Google OAuth Credentials
  GOOGLE_CLIENT_ID: z.string().min(1, 'GOOGLE_CLIENT_ID is required'),
  GOOGLE_CLIENT_SECRET: z.string().min(1, 'GOOGLE_CLIENT_SECRET is required'),
  // Callback URL must match exactly what's registered in Google Cloud Console
  // It will be something like http://<your-cloud-run-url>/api/auth/google/callback
  GOOGLE_CALLBACK_URL: z.string().url(),
});

// Example .env file structure:
/*
NODE_ENV=development
PORT=3000
DATABASE_URL="prisma://..." # Or your D1 connection details
JWT_SECRET="your_super_secret_jwt_key_at_least_32_chars_long"
FRONTEND_URL="http://localhost:5173" # Or your deployed frontend URL

GOOGLE_CLIENT_ID="YOUR_GOOGLE_CLIENT_ID.apps.googleusercontent.com"
GOOGLE_CLIENT_SECRET="YOUR_GOOGLE_CLIENT_SECRET"
GOOGLE_CALLBACK_URL="http://localhost:3000/api/auth/google/callback" # Adjust for deployment
*/

