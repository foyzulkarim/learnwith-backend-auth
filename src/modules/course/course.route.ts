import { FastifyInstance } from 'fastify';
import { CourseService } from './course.service';
import { CourseController } from './course.controller';
import {
  authenticate,
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

  // Apply global authentication middleware
  fastify.addHook('onRequest', authenticate);

  // Course Routes
  // GET /api/courses - Get all courses
  fastify.get('/', courseController.getAllCoursesHandler);

  // GET /api/courses/:courseId - Get course by ID
  fastify.get(
    '/:courseId',
    {
      schema: getCourseSchema,
      preHandler: validateCourseId,
    },
    courseController.getCourseByIdHandler,
  );

  // POST /api/courses - Create course
  fastify.post(
    '/',
    {
      schema: createCourseSchema,
    },
    courseController.createCourseHandler,
  );

  // PUT /api/courses/:courseId - Update course
  fastify.put(
    '/:courseId',
    {
      schema: updateCourseSchema,
      preHandler: validateCourseId,
    },
    courseController.updateCourseHandler,
  );

  // DELETE /api/courses/:courseId - Delete course
  fastify.delete(
    '/:courseId',
    {
      schema: getCourseSchema,
      preHandler: validateCourseId,
    },
    courseController.deleteCourseHandler,
  );

  // Curriculum Routes
  // GET /api/courses/:courseId/curriculum - Get course curriculum
  fastify.get(
    '/:courseId/curriculum',
    {
      schema: getCourseSchema,
      preHandler: validateCourseId,
    },
    courseController.getCurriculumHandler,
  );

  // Module Routes
  // GET /api/courses/:courseId/modules/:moduleId - Get module
  fastify.get(
    '/:courseId/modules/:moduleId',
    {
      schema: getModuleSchema,
      preHandler: [validateCourseId, validateModuleId],
    },
    courseController.getModuleHandler,
  );

  // POST /api/courses/:courseId/modules - Create module
  fastify.post(
    '/:courseId/modules',
    {
      schema: createModuleSchema,
      preHandler: validateCourseId,
    },
    courseController.createModuleHandler,
  );

  // PUT /api/courses/:courseId/modules/:moduleId - Update module
  fastify.put(
    '/:courseId/modules/:moduleId',
    {
      schema: updateModuleSchema,
      preHandler: [validateCourseId, validateModuleId],
    },
    courseController.updateModuleHandler,
  );

  // DELETE /api/courses/:courseId/modules/:moduleId - Delete module
  fastify.delete(
    '/:courseId/modules/:moduleId',
    {
      schema: getModuleSchema,
      preHandler: [validateCourseId, validateModuleId],
    },
    courseController.deleteModuleHandler,
  );

  // Lesson Routes
  // GET /api/courses/:courseId/modules/:moduleId/lessons/:lessonId - Get lesson
  fastify.get(
    '/:courseId/modules/:moduleId/lessons/:lessonId',
    {
      schema: getLessonSchema,
      preHandler: [validateCourseId, validateModuleId, validateLessonId],
    },
    courseController.getLessonHandler,
  );

  // POST /api/courses/:courseId/modules/:moduleId/lessons - Create lesson
  fastify.post(
    '/:courseId/modules/:moduleId/lessons',
    {
      schema: createLessonSchema,
      preHandler: [validateCourseId, validateModuleId],
    },
    courseController.createLessonHandler,
  );

  // PUT /api/courses/:courseId/modules/:moduleId/lessons/:lessonId - Update lesson
  fastify.put(
    '/:courseId/modules/:moduleId/lessons/:lessonId',
    {
      schema: updateLessonSchema,
      preHandler: [validateCourseId, validateModuleId, validateLessonId],
    },
    courseController.updateLessonHandler,
  );

  // DELETE /api/courses/:courseId/modules/:moduleId/lessons/:lessonId - Delete lesson
  fastify.delete(
    '/:courseId/modules/:moduleId/lessons/:lessonId',
    {
      schema: getLessonSchema,
      preHandler: [validateCourseId, validateModuleId, validateLessonId],
    },
    courseController.deleteLessonHandler,
  );
}
