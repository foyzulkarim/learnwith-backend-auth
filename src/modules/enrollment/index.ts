import { FastifyInstance } from 'fastify';
import enrollmentRoutes from './enrollment.route';

export default async function enrollmentModule(fastify: FastifyInstance): Promise<void> {
  // Register enrollment routes
  fastify.register(enrollmentRoutes, { prefix: '/api/enrollments' });
}
