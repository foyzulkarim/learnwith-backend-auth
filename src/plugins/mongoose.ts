import fp from 'fastify-plugin';
import { FastifyInstance } from 'fastify';
import mongoose from 'mongoose';
import { config, isProd } from '../config';
import { DatabaseError } from '../utils/errors';

// Extend FastifyInstance interface
declare module 'fastify' {
  interface FastifyInstance {
    mongoose: typeof mongoose;
  }
}

export default fp(
  async function mongoosePlugin(fastify: FastifyInstance) {
    try {
      // Set mongoose connection options based on environment
      const connectionOptions = {
        // Common options
        autoIndex: !isProd, // Don't build indexes in production
        serverSelectionTimeoutMS: 5000, // Timeout for server selection
        socketTimeoutMS: 45000, // Close sockets after 45 seconds of inactivity
        family: 4, // Use IPv4, skip trying IPv6

        // Production-specific options
        ...(isProd && {
          maxPoolSize: 50, // Maintain up to 50 socket connections
          minPoolSize: 10, // Maintain at least 10 socket connections
          connectTimeoutMS: 10000, // Give up initial connection after 10 seconds
        }),
      };

      // Connect to MongoDB with enhanced options
      await mongoose.connect(config.DATABASE_URL, connectionOptions);

      // Set mongoose debug mode in development for query logging
      mongoose.set('debug', config.NODE_ENV === 'development');

      // Decorate Fastify instance with mongoose
      fastify.decorate('mongoose', mongoose);

      // Add hook to disconnect Mongoose when Fastify closes
      fastify.addHook('onClose', async (instance) => {
        await mongoose.connection.close();
        instance.log.info('Mongoose connection closed.');
      });

      // Log connection events for better observability
      mongoose.connection.on('connected', () => {
        fastify.log.info('MongoDB connection established');
      });

      mongoose.connection.on('disconnected', () => {
        fastify.log.warn('MongoDB connection disconnected');
      });

      mongoose.connection.on('error', (err) => {
        fastify.log.error({ err }, 'MongoDB connection error');
      });

      fastify.log.info('Connected to MongoDB successfully');
    } catch (error) {
      fastify.log.error('Error connecting to MongoDB:', error);
      // Instead of direct process.exit, throw a more descriptive error
      // that can be caught higher up in the app bootstrap
      throw new DatabaseError(
        'Failed to connect to MongoDB. Please check your connection string and database status.',
        'MONGODB_CONNECTION_ERROR',
      );
    }
  },
  { name: 'mongoose' },
);
