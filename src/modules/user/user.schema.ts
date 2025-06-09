// src/modules/user/user.schema.ts
import { FastifySchema } from 'fastify';

/**
 * Schema for updating user profile
 */
export const updateProfileSchema: FastifySchema = {
  body: {
    type: 'object',
    properties: {
      name: { type: 'string' },
      email: { type: 'string', format: 'email' },
      bio: { type: 'string' },
      emailPreferences: {
        type: 'object',
        properties: {
          marketing: { type: 'boolean' },
          coursesUpdates: { type: 'boolean' },
          accountNotifications: { type: 'boolean' },
        },
      },
    },
  },
  response: {
    200: {
      type: 'object',
      properties: {
        id: { type: 'string' },
        email: { type: 'string' },
        name: { type: ['string', 'null'] },
        bio: { type: 'string' },
        emailPreferences: {
          type: 'object',
          properties: {
            marketing: { type: 'boolean' },
            coursesUpdates: { type: 'boolean' },
            accountNotifications: { type: 'boolean' },
          },
        },
        role: { type: 'string' },
        updatedAt: { type: 'string', format: 'date-time' },
      },
    },
  },
};