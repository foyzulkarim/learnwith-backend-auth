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
  console.warn(
    `Warning: Could not load .env file from ${envPath}:`,
    result.error.message
  );
}

// Parse and validate the config
let config: AppConfig;

try {
  config = envSchema.parse(process.env);
  console.log('Configuration loaded successfully.');
} catch (error) {
  console.error('❌ Invalid environment variables:', error);
  // Exit the process if validation fails, as the app cannot run correctly
  process.exit(1);
}

// Export the validated config
export { config };
