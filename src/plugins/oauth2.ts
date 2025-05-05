// src/plugins/oauth2.ts
import fp from 'fastify-plugin';
import fastifyOAuth2, { OAuth2Namespace } from '@fastify/oauth2'; // Import OAuth2Namespace
import { FastifyInstance } from 'fastify';
import { config } from '../config';

// Augment the FastifyInstance interface to include the googleOAuth2 property
declare module 'fastify' {
  interface FastifyInstance {
    googleOAuth2: OAuth2Namespace; // Add the property with the correct type
  }
}

export default fp(async function oauth2Plugin(fastify: FastifyInstance) {
  fastify.register(fastifyOAuth2, {
    name: 'googleOAuth2', // Strategy name - THIS MUST MATCH the property name above
    scope: ['profile', 'email'], // Request user's profile and email
    credentials: {
      client: {
        id: config.GOOGLE_CLIENT_ID,
        secret: config.GOOGLE_CLIENT_SECRET,
      },
      auth: fastifyOAuth2.GOOGLE_CONFIGURATION, // Use predefined Google config
    },
    startRedirectPath: '/api/auth/google', // Route to initiate Google login
    callbackUri: config.GOOGLE_CALLBACK_URL, // The verified redirect URI
  });
});
