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
    // Log the error and continue without crashing the application
    fastify.log.error(
      { err: error },
      'Failed to register Google OAuth2 integration. OAuth login will not be available.',
    );
  }
});
