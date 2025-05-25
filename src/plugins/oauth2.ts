// src/plugins/oauth2.ts
import fp from 'fastify-plugin';
import fastifyOAuth2, { OAuth2Namespace } from '@fastify/oauth2';
import { FastifyInstance } from 'fastify';
import { config } from '../config';

// Augment the FastifyInstance interface to include the googleOAuth2 property
declare module 'fastify' {
  interface FastifyInstance {
    googleOAuth2?: OAuth2Namespace;
  }
}

export default fp(async function oauth2Plugin(fastify: FastifyInstance) {
  try {
    // Validate required configuration before attempting registration
    if (!config.GOOGLE_CLIENT_ID || !config.GOOGLE_CLIENT_SECRET) {
      fastify.log.warn(
        'Google OAuth2 credentials not configured. OAuth login will not be available.',
      );
      return; // Exit gracefully without registration
    }

    // Instead of using the discovery protocol, use direct token endpoints
    // This avoids network issues when trying to contact accounts.google.com for discovery
    fastify.register(fastifyOAuth2, {
      name: 'googleOAuth2',
      scope: ['openid', 'profile', 'email'],
      credentials: {
        client: {
          id: config.GOOGLE_CLIENT_ID,
          secret: config.GOOGLE_CLIENT_SECRET,
        },
        auth: {
          authorizeHost: 'https://accounts.google.com',
          authorizePath: '/o/oauth2/v2/auth',
          tokenHost: 'https://oauth2.googleapis.com',
          tokenPath: '/token',
        },
      },
      // Don't use discovery to avoid the network lookup
      // discovery: {
      //   issuer: 'https://accounts.google.com'
      // },
      startRedirectPath: '/api/auth/google',
      callbackUri: config.GOOGLE_CALLBACK_URL,
    });

    fastify.log.info('Google OAuth2 integration registered successfully');
  } catch (error) {
    // Categorize errors and handle appropriately
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    const errorCode =
      error instanceof Error && 'code' in error ? (error as { code: string }).code : undefined;

    // Only continue silently for network-related issues
    if (errorCode === 'ENOTFOUND' || errorCode === 'ECONNREFUSED' || errorCode === 'ETIMEDOUT') {
      fastify.log.warn(
        { err: error },
        'OAuth2 registration failed due to network issues. OAuth login will be disabled.',
      );
      return; // Continue without OAuth2
    }

    // For configuration or other critical errors, log but don't crash
    if (errorMessage.includes('client_id') || errorMessage.includes('client_secret')) {
      fastify.log.error(
        { err: error },
        'OAuth2 registration failed due to configuration error. Check Google OAuth2 credentials.',
      );
      return;
    }

    // For all other errors, log and re-throw to prevent silent failures
    fastify.log.error(
      { err: error },
      'OAuth2 registration failed with unexpected error. This may indicate a critical issue.',
    );
    throw error; // Re-throw unexpected errors
  }
});
