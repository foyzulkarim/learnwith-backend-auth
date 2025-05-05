// src/plugins/prisma.ts (Essential for DB access)
import fp from 'fastify-plugin';
import { FastifyInstance } from 'fastify';
import { PrismaClient } from '@prisma/client';
import { config } from '../config';

// Extend FastifyInstance interface
declare module 'fastify' {
  interface FastifyInstance {
    prisma: PrismaClient;
  }
}

export default fp(
  async function prismaPlugin(fastify: FastifyInstance) {
    const prisma = new PrismaClient({
      // Add logging or other Prisma client options if needed
      log:
        config.NODE_ENV === 'development'
          ? ['query', 'info', 'warn', 'error']
          : ['error'],
    });

    // Connect Prisma (optional, Prisma connects lazily)
    // await prisma.$connect(); // Uncomment if you want to connect explicitly on startup

    // Decorate Fastify instance with Prisma client
    fastify.decorate('prisma', prisma);

    // Add hook to disconnect Prisma when Fastify closes
    fastify.addHook('onClose', async (instance) => {
      await instance.prisma.$disconnect();
      instance.log.info('Prisma client disconnected.');
    });
  },
  { name: 'prisma' }
); // Add name for dependency tracking if needed
