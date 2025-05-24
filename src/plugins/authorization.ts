// src/plugins/authorization.ts
import { FastifyInstance, FastifyRequest, FastifyReply, HookHandlerDoneFunction } from 'fastify';
import fp from 'fastify-plugin';
import { UserJWTPayload } from './jwt'; // Assuming jwt.ts is in the same plugins directory
import { AuthorizationError } from '../utils/errors';

// Augment FastifyInstance
declare module 'fastify' {
  interface FastifyInstance {
    authorize: (allowedRoles: string[]) => (request: FastifyRequest, reply: FastifyReply) => Promise<void>;
  }
}

export interface AuthorizePluginOptions {
  // No options needed for now, but can be extended
}

function authorizePlugin(fastify: FastifyInstance, _opts: AuthorizePluginOptions, done: HookHandlerDoneFunction) {
  fastify.decorate('authorize', function(allowedRoles: string[]) {
    return async (request: FastifyRequest, reply: FastifyReply) => { // Changed to be an async arrow function
      // request.user should be populated by the authenticate decorator
      // UserJWTPayload (from jwt.ts) includes 'role'
      const user = request.user as UserJWTPayload | undefined;

      if (!user || !user.role) {
        // This should ideally not happen if 'authenticate' runs first and populates request.user
        fastify.log.warn('Authorization check failed: request.user or request.user.role is missing.');
        throw new AuthorizationError('User authentication data is missing or incomplete.', 'AUTH_DATA_MISSING');
      }

      const userRole = user.role;
      if (!allowedRoles.includes(userRole)) {
        fastify.log.warn(
          { userId: user.id, userRole, allowedRoles },
          `Authorization denied for user ${user.id} with role ${userRole}. Allowed roles: ${allowedRoles.join(', ')}`
        );
        // Throwing AuthorizationError without arguments will use the defaults from the class definition:
        // message: 'You do not have permission to access this resource.'
        // errorCode: 'FORBIDDEN'
        // statusCode: 403
        throw new AuthorizationError(); 
      }
      // If role is allowed, do nothing, request proceeds.
      // fastify.log.info(`User ${user.id} with role ${userRole} authorized for resource requiring one of [${allowedRoles.join(', ')}] roles.`);
    };
  });
  done();
}

export default fp(authorizePlugin, {
  name: 'fastify-authorization',
  dependencies: ['fastify-jwt'] // Explicitly declare dependency on jwt plugin
});
