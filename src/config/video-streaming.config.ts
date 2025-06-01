import { z } from 'zod';

// Define schema for video streaming config
const videoStreamingConfigSchema = z.object({
  // Cloudflare R2 credentials
  CLOUDFLARE_ACCOUNT_ID: z.string().min(1, 'Cloudflare Account ID is required'),
  R2_ACCESS_KEY_ID: z.string().min(1, 'R2 Access Key ID is required'),
  R2_SECRET_ACCESS_KEY: z.string().min(1, 'R2 Secret Access Key is required'),
  R2_BUCKET_NAME: z.string().min(1, 'R2 Bucket Name is required'),

  // API configuration
  API_BASE_URL: z.string().url('API Base URL must be a valid URL'),

  // Signed URL options
  SIGNED_URL_EXPIRATION: z
    .string()
    .transform((val) => parseInt(val, 10))
    .refine((val) => !isNaN(val) && val > 0, 'Signed URL Expiration must be a positive number')
    .optional()
    .default('3600'), // 1 hour default
});

// Extract type from the schema
type VideoStreamingConfig = z.infer<typeof videoStreamingConfigSchema>;

// Parse and validate the config
export const videoStreamingConfig = (): VideoStreamingConfig => {
  try {
    return videoStreamingConfigSchema.parse(process.env);
  } catch (error) {
    if (error instanceof z.ZodError) {
      const missingVars = error.errors.map((e) => e.path.join('.'));
      console.error(
        `Video streaming configuration is invalid or incomplete. Missing/invalid variables: ${missingVars.join(', ')}`,
      );

      // In development, provide more detailed error information
      if (process.env.NODE_ENV !== 'production') {
        console.error('Validation errors:', error.errors);

        console.info(`
=== VIDEO STREAMING CONFIGURATION GUIDE ===
To enable video streaming from private storage, please set the following environment variables:

CLOUDFLARE_ACCOUNT_ID=your-cloudflare-account-id
R2_ACCESS_KEY_ID=your-r2-access-key
R2_SECRET_ACCESS_KEY=your-r2-secret-access-key
R2_BUCKET_NAME=your-bucket-name
API_BASE_URL=https://your-api-domain.com (or http://localhost:4000 for local development)
SIGNED_URL_EXPIRATION=3600 (expiration time in seconds, default is 1 hour)

You can add these to your .env file or configure them in your deployment environment.
        `);
      }
    } else {
      console.error('Unexpected error validating video streaming config:', error);
    }

    // Return a partially valid config with defaults to avoid crashing the app
    // In production, video streaming will fail but the app will still run
    return {
      CLOUDFLARE_ACCOUNT_ID: process.env.CLOUDFLARE_ACCOUNT_ID || '',
      R2_ACCESS_KEY_ID: process.env.R2_ACCESS_KEY_ID || '',
      R2_SECRET_ACCESS_KEY: process.env.R2_SECRET_ACCESS_KEY || '',
      R2_BUCKET_NAME: process.env.R2_BUCKET_NAME || '',
      API_BASE_URL: process.env.API_BASE_URL || '',
      SIGNED_URL_EXPIRATION: parseInt(process.env.SIGNED_URL_EXPIRATION || '3600', 10),
    };
  }
};

export default videoStreamingConfig;
