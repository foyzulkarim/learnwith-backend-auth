import { FastifyInstance } from 'fastify';
import { CourseService } from './course.service';
import { CourseController } from './course.controller';

export default async function courseRoutes(fastify: FastifyInstance) {
  const courseService = new CourseService(fastify);
  const courseController = new CourseController(courseService);

  fastify.get('/', courseController.getAllCoursesHandler.bind(courseController));
}
