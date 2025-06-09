// src/modules/user/user.request.ts
import { EmailPreferences } from './types';

/**
 * Request payload for updating user profile
 */
export interface UpdateProfileRequest {
  name?: string;
  email?: string;
  bio?: string;
  emailPreferences?: Partial<EmailPreferences>;
}