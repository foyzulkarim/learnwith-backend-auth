// src/utils/logConfig.ts
/**
 * Centralized logging configuration
 * This file contains all configuration options for the logging system
 */

import path from 'path';

// Default log directory
export const LOG_DIR = process.env.LOG_DIR || path.join(process.cwd(), 'logs');

// Log levels based on environment
export const LOG_LEVEL =
  process.env.LOG_LEVEL || (process.env.NODE_ENV === 'production' ? 'info' : 'debug');

// Loggly configuration
export const LOGGLY_CONFIG = {
  enabled: Boolean(process.env.LOGGLY_TOKEN && process.env.LOGGLY_SUBDOMAIN),
  token: process.env.LOGGLY_TOKEN || '',
  subdomain: process.env.LOGGLY_SUBDOMAIN || '',
  tags: (process.env.LOGGLY_TAGS || 'nodejs,learnwith-backend').split(','),
};

// Log rotation configuration
export const LOG_ROTATION_CONFIG = {
  maxFileSize: Number(process.env.LOG_MAX_SIZE || 10 * 1024 * 1024), // 10MB default
  maxFiles: Number(process.env.LOG_MAX_FILES || 7), // 7 files default
  maxAge: Number(process.env.LOG_MAX_AGE || 7 * 24 * 60 * 60 * 1000), // 7 days default
  filePattern: /^app-\d{4}-\d{2}-\d{2}\.log$/, // Match app-YYYY-MM-DD.log
};

// Log sampling configuration
export const LOG_SAMPLING_CONFIG = {
  defaultRate: Number(process.env.LOG_SAMPLING_RATE || 1.0), // Default sampling rate
  routes: {
    '/api/courses': Number(process.env.LOG_SAMPLING_COURSES || 0.2), // Sample 20% of course listing requests
    '/api/hls': Number(process.env.LOG_SAMPLING_HLS || 0.05), // Sample only 5% of HLS video requests
    '/api/auth': 1.0, // Always log all auth requests
  },
};

// Sensitive fields that should be masked in logs
export const SENSITIVE_FIELDS = [
  'password',
  'token',
  'secret',
  'apiKey',
  'authorization',
  'refreshToken',
  'creditCard',
  'ssn',
];

// Function to mask sensitive data in logs
export function maskSensitiveData(obj: Record<string, any>): Record<string, any> {
  if (!obj || typeof obj !== 'object') {
    return obj;
  }

  const result: Record<string, any> = {};

  for (const [key, value] of Object.entries(obj)) {
    // Check if this key contains sensitive information
    const isSensitive = SENSITIVE_FIELDS.some((field) =>
      key.toLowerCase().includes(field.toLowerCase()),
    );

    if (isSensitive && typeof value === 'string') {
      // Mask sensitive string values
      result[key] = value.length > 0 ? '***MASKED***' : value;
    } else if (typeof value === 'object' && value !== null) {
      // Recursively process nested objects
      result[key] = maskSensitiveData(value);
    } else {
      // Pass through non-sensitive values
      result[key] = value;
    }
  }

  return result;
}
