// src/plugins/oauth2.ts
import fp from 'fastify-plugin';
import fastifyOAuth2, { OAuth2Namespace } from '@fastify/oauth2';
import { FastifyInstance } from 'fastify';
import { config } from '../config';

// Augment the FastifyInstance interface to include the googleOAuth2 property
declare module 'fastify' {
  interface FastifyInstance {
    googleOAuth2: OAuth2Namespace;
  }
}

export default fp(async function oauth2Plugin(fastify: FastifyInstance) {
  fastify.register(fastifyOAuth2, {
    name: 'googleOAuth2',
    // Use OpenID Connect scopes to ensure we get proper profile information
    scope: ['openid', 'profile', 'email'],
    credentials: {
      client: {
        id: config.GOOGLE_CLIENT_ID,
        secret: config.GOOGLE_CLIENT_SECRET,
      }
    },
    discovery: {
      issuer: 'https://accounts.google.com'
    },
    startRedirectPath: '/api/auth/google',
    callbackUri: config.GOOGLE_CALLBACK_URL,
  });
}); 
