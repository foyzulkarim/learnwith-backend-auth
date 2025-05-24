// src/config/schema.ts
import { z } from 'zod';

// Define schema for environment variables
export const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z.coerce.number().default(3000),
  DATABASE_URL: z.string().url(), // Connection string for MongoDB
  JWT_SECRET: z.string().min(32, 'JWT_SECRET must be at least 32 characters long'),
  FRONTEND_URL: z.string().url().default('http://localhost:3030'), // URL of your frontend app
  ALLOWED_ORIGINS: z.string().optional().default('http://localhost:3030'), // Comma-separated list of allowed origins for CORS

  // Google OAuth Credentials
  GOOGLE_CLIENT_ID: z.string().min(1, 'GOOGLE_CLIENT_ID is required'),
  GOOGLE_CLIENT_SECRET: z.string().min(1, 'GOOGLE_CLIENT_SECRET is required'),
  // Callback URL must match exactly what's registered in Google Cloud Console
  // It will be something like http://<your-cloud-run-url>/api/auth/google/callback
  GOOGLE_CALLBACK_URL: z.string().url(),

  // JWT Configuration
  JWT_ACCESS_TOKEN_EXPIRY: z.string().default('1h'),
  JWT_REFRESH_TOKEN_EXPIRY: z.string().default('7d'),

  // Cookie Configuration
  COOKIE_SAME_SITE: z.enum(['strict', 'lax', 'none']).default('lax'),

  // Cloudflare R2 Configuration for Video Storage
  CLOUDFLARE_ACCOUNT_ID: z.string().min(1, 'CLOUDFLARE_ACCOUNT_ID is required'),
  R2_ACCESS_KEY_ID: z.string().min(1, 'R2_ACCESS_KEY_ID is required'),
  R2_SECRET_ACCESS_KEY: z.string().min(1, 'R2_SECRET_ACCESS_KEY is required'),
  R2_BUCKET_NAME: z.string().min(1, 'R2_BUCKET_NAME is required'),
  SIGNED_URL_EXPIRATION: z.coerce.number().default(3600), // 1 hour in seconds
});

// Example .env file structure:
/*
NODE_ENV=development
PORT=3000
DATABASE_URL="mongodb://localhost:27017/learnwith"
JWT_SECRET="your_super_secret_jwt_key_at_least_32_chars_long"
FRONTEND_URL="http://localhost:5173" # Or your deployed frontend URL
ALLOWED_ORIGINS="http://localhost:5173,https://your-app.com" # For CORS

GOOGLE_CLIENT_ID="YOUR_GOOGLE_CLIENT_ID.apps.googleusercontent.com"
GOOGLE_CLIENT_SECRET="YOUR_GOOGLE_CLIENT_SECRET"
GOOGLE_CALLBACK_URL="http://localhost:3000/api/auth/google/callback" # Adjust for deployment

JWT_ACCESS_TOKEN_EXPIRY="1h"
JWT_REFRESH_TOKEN_EXPIRY="7d"
COOKIE_SAME_SITE="lax"
*/
