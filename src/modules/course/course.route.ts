import { FastifyInstance } from 'fastify';
import { CourseService } from './course.service';
import { CourseController } from './course.controller';
import {
  validateCourseId,
  validateModuleId,
  validateLessonId,
  authorizeRoles,
  authenticate,
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

export default async function courseRoutes(fastify: FastifyInstance): Promise<void> {
  const courseService = new CourseService(fastify);
  const courseController = new CourseController(courseService);

  // Create a preHandler wrapper for authentication
  const authPreHandler = async (request: any, reply: any) => {
    await authenticate(request, reply);
  };

  // Authentication is now handled globally in app.ts

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

  // POST /api/courses - Create course (creator or admin only)
  fastify.post(
    '/',
    {
      schema: createCourseSchema,
      preHandler: [authPreHandler, authorizeRoles(['creator', 'admin'])],
    },
    courseController.createCourseHandler,
  );

  // PUT /api/courses/:courseId - Update course (creator or admin only)
  fastify.put(
    '/:courseId',
    {
      schema: updateCourseSchema,
      preHandler: [authPreHandler, validateCourseId, authorizeRoles(['creator', 'admin'])],
    },
    courseController.updateCourseHandler,
  );

  // DELETE /api/courses/:courseId - Delete course
  fastify.delete(
    '/:courseId',
    {
      schema: getCourseSchema,
      preHandler: [authPreHandler, validateCourseId, authorizeRoles(['creator', 'admin'])],
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

  // ACTIVE Module Routes - These are the routes currently being used by the frontend
  // POST /api/courses/:courseId/modules - Create module (creator or admin only)
  fastify.post(
    '/:courseId/modules',
    {
      schema: createModuleSchema,
      preHandler: [authPreHandler, validateCourseId, authorizeRoles(['creator', 'admin'])],
    },
    courseController.createModuleHandler,
  );

  // PUT /api/courses/:courseId/modules/:moduleId - Update module (creator or admin only)
  fastify.put(
    '/:courseId/modules/:moduleId',
    {
      schema: updateModuleSchema,
      preHandler: [
        authPreHandler,
        validateCourseId,
        validateModuleId,
        authorizeRoles(['creator', 'admin']),
      ],
    },
    courseController.updateModuleHandler,
  );

  // DELETE /api/courses/:courseId/modules/:moduleId - Delete module
  fastify.delete(
    '/:courseId/modules/:moduleId',
    {
      schema: getModuleSchema,
      preHandler: [
        authPreHandler,
        validateCourseId,
        validateModuleId,
        authorizeRoles(['creator', 'admin']),
      ],
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

  // POST /api/courses/:courseId/modules/:moduleId/lessons - Create lesson (creator or admin only)
  fastify.post(
    '/:courseId/modules/:moduleId/lessons',
    {
      schema: createLessonSchema,
      preHandler: [
        authPreHandler,
        validateCourseId,
        validateModuleId,
        authorizeRoles(['creator', 'admin']),
      ],
    },
    courseController.createLessonHandler,
  );

  // PUT /api/courses/:courseId/modules/:moduleId/lessons/:lessonId - Update lesson (creator or admin only)
  fastify.put(
    '/:courseId/modules/:moduleId/lessons/:lessonId',
    {
      schema: updateLessonSchema,
      preHandler: [
        authPreHandler,
        validateCourseId,
        validateModuleId,
        validateLessonId,
        authorizeRoles(['creator', 'admin']),
      ],
    },
    courseController.updateLessonHandler,
  );

  // DELETE /api/courses/:courseId/modules/:moduleId/lessons/:lessonId - Delete lesson (creator or admin only)
  fastify.delete(
    '/:courseId/modules/:moduleId/lessons/:lessonId',
    {
      schema: getLessonSchema,
      preHandler: [
        authPreHandler,
        validateCourseId,
        validateModuleId,
        validateLessonId,
        authorizeRoles(['creator', 'admin']),
      ],
    },
    courseController.deleteLessonHandler,
  );
}
