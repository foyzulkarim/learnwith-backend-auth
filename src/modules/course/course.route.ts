import { FastifyInstance } from 'fastify';
import { CourseService } from './course.service';
import { CourseController } from './course.controller';
// Removed old authenticate import, keeping validation middleware
import {
  validateCourseId,
  validateModuleId,
  validateLessonId,
} from '../../utils/middleware';
import {
  getCourseSchema,
  createCourseSchema,
  updateCourseSchema,
  getModuleSchema,
  createModuleSchema,
  updateModuleSchema,
  getLessonSchema,
  createLessonSchema,
  updateLessonSchema,
} from './validation';

export default async function courseRoutes(fastify: FastifyInstance) {
  const courseService = new CourseService(fastify);
  const courseController = new CourseController(courseService);

  // Global hook removed, authenticate decorator applied per-route

  // Course Routes
  // GET /api/courses - Get all courses
  fastify.get('/', { preHandler: [fastify.authenticate] }, courseController.getAllCoursesHandler);

  // GET /api/courses/:courseId - Get course by ID
  fastify.get(
    '/:courseId',
    {
      schema: getCourseSchema,
      preHandler: [fastify.authenticate, validateCourseId],
    },
    courseController.getCourseByIdHandler,
  );

  // POST /api/courses - Create course
  fastify.post(
    '/',
    {
      schema: createCourseSchema,
      preHandler: [fastify.authenticate, fastify.authorize(['creator'])],
    },
    courseController.createCourseHandler,
  );

  // PUT /api/courses/:courseId - Update course
  fastify.put(
    '/:courseId',
    {
      schema: updateCourseSchema,
      preHandler: [fastify.authenticate, fastify.authorize(['creator']), validateCourseId],
    },
    courseController.updateCourseHandler,
  );

  // DELETE /api/courses/:courseId - Delete course
  fastify.delete(
    '/:courseId',
    {
      schema: getCourseSchema, // Should probably be a schema specific to delete if it expects a body or specific params
      preHandler: [fastify.authenticate, fastify.authorize(['creator']), validateCourseId],
    },
    courseController.deleteCourseHandler,
  );

  // Curriculum Routes
  // GET /api/courses/:courseId/curriculum - Get course curriculum
  fastify.get(
    '/:courseId/curriculum',
    {
      schema: getCourseSchema,
      preHandler: [fastify.authenticate, validateCourseId],
    },
    courseController.getCurriculumHandler,
  );

  // ACTIVE Module Routes - These are the routes currently being used by the frontend
  // POST /api/courses/:courseId/modules - Create module
  fastify.post(
    '/:courseId/modules',
    {
      schema: createModuleSchema,
      preHandler: [fastify.authenticate, fastify.authorize(['creator']), validateCourseId],
    },
    courseController.createModuleHandler,
  );

  // PUT /api/courses/:courseId/modules/:moduleId - Update module
  fastify.put(
    '/:courseId/modules/:moduleId',
    {
      schema: updateModuleSchema,
      preHandler: [fastify.authenticate, fastify.authorize(['creator']), validateCourseId, validateModuleId],
    },
    courseController.updateModuleHandler,
  );

  // DELETE /api/courses/:courseId/modules/:moduleId - Delete module
  fastify.delete(
    '/:courseId/modules/:moduleId',
    {
      schema: getModuleSchema, // Schema might need adjustment for DELETE
      preHandler: [fastify.authenticate, fastify.authorize(['creator']), validateCourseId, validateModuleId],
    },
    courseController.deleteModuleHandler,
  );

  // Lesson Routes
  // GET /api/courses/:courseId/modules/:moduleId/lessons/:lessonId - Get lesson
  fastify.get(
    '/:courseId/modules/:moduleId/lessons/:lessonId',
    {
      schema: getLessonSchema,
      preHandler: [fastify.authenticate, validateCourseId, validateModuleId, validateLessonId],
    },
    courseController.getLessonHandler,
  );

  // POST /api/courses/:courseId/modules/:moduleId/lessons - Create lesson
  fastify.post(
    '/:courseId/modules/:moduleId/lessons',
    {
      schema: createLessonSchema,
      preHandler: [fastify.authenticate, fastify.authorize(['creator']), validateCourseId, validateModuleId],
    },
    courseController.createLessonHandler,
  );

  // PUT /api/courses/:courseId/modules/:moduleId/lessons/:lessonId - Update lesson
  fastify.put(
    '/:courseId/modules/:moduleId/lessons/:lessonId',
    {
      schema: updateLessonSchema,
      preHandler: [fastify.authenticate, fastify.authorize(['creator']), validateCourseId, validateModuleId, validateLessonId],
    },
    courseController.updateLessonHandler,
  );

  // DELETE /api/courses/:courseId/modules/:moduleId/lessons/:lessonId - Delete lesson
  fastify.delete(
    '/:courseId/modules/:moduleId/lessons/:lessonId',
    {
      schema: getLessonSchema, // Schema might need adjustment for DELETE
      preHandler: [fastify.authenticate, fastify.authorize(['creator']), validateCourseId, validateModuleId, validateLessonId],
    },
    courseController.deleteLessonHandler,
  );
}
