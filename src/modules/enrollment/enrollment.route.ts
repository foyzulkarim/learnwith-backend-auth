import { FastifyInstance } from 'fastify';
import { EnrollmentService } from './enrollment.service';
import { EnrollmentController } from './enrollment.controller';
import { authenticate, validateCourseId, validateLessonId } from '../../utils/middleware';

export default async function enrollmentRoutes(fastify: FastifyInstance): Promise<void> {
  const enrollmentService = new EnrollmentService(fastify);
  const enrollmentController = new EnrollmentController(enrollmentService);

  // Create a preHandler wrapper for authentication
  const authPreHandler = async (request: any, reply: any) => {
    await authenticate(request, reply);
  };

  // Enrollment Routes

  // GET /api/enrollments - Get all courses a user is enrolled in
  fastify.get(
    '/courses',
    {
      preHandler: [authPreHandler],
    },
    enrollmentController.getUserEnrollments,
  );

  // POST /api/enrollments/courses/:courseId - Enroll a user in a course
  fastify.post(
    '/courses/:courseId',
    {
      preHandler: [authPreHandler, validateCourseId],
    },
    enrollmentController.enrollUserInCourse,
  );

  // GET /api/enrollments/courses/:courseId - Check if a user is enrolled in a course and get enrollment details
  fastify.get(
    '/courses/:courseId',
    {
      preHandler: [authPreHandler, validateCourseId],
    },
    enrollmentController.getEnrollmentDetails,
  );

  // GET /api/enrollments/courses/:courseId/resume - Get the first lesson or last watched lesson for resuming
  fastify.get(
    '/courses/:courseId/resume',
    {
      preHandler: [authPreHandler, validateCourseId],
    },
    enrollmentController.getResumeLesson,
  );

  // GET /api/enrollments/courses/:courseId/progress - Get all lesson progress for a course
  fastify.get(
    '/courses/:courseId/progress',
    {
      preHandler: [authPreHandler, validateCourseId],
    },
    enrollmentController.getLessonProgress,
  );

  // PUT /api/enrollments/courses/:courseId/lessons/:lessonId/watch - Update the last watched lesson
  fastify.put(
    '/courses/:courseId/lessons/:lessonId/watch',
    {
      preHandler: [authPreHandler, validateCourseId, validateLessonId],
      schema: {
        body: {
          type: 'object',
          properties: {
            duration: { type: 'number', description: 'Duration watched in seconds' },
          },
        },
      },
    },
    enrollmentController.updateLastWatchedLesson,
  );

  // PUT /api/enrollments/courses/:courseId/lessons/:lessonId/complete - Mark a lesson as completed
  fastify.put(
    '/courses/:courseId/lessons/:lessonId/complete',
    {
      preHandler: [authPreHandler, validateCourseId, validateLessonId],
    },
    enrollmentController.markLessonAsCompleted,
  );

  // PUT /api/enrollments/courses/:courseId/lessons/:lessonId/notes - Update lesson notes
  fastify.put(
    '/courses/:courseId/lessons/:lessonId/notes',
    {
      preHandler: [authPreHandler, validateCourseId, validateLessonId],
      schema: {
        body: {
          type: 'object',
          required: ['notes'],
          properties: {
            notes: { type: 'string', description: 'Notes for the lesson' },
          },
        },
      },
    },
    enrollmentController.updateLessonNotes,
  );

  // PUT /api/enrollments/courses/:courseId/lessons/:lessonId/bookmark - Toggle lesson bookmark
  fastify.put(
    '/courses/:courseId/lessons/:lessonId/bookmark',
    {
      preHandler: [authPreHandler, validateCourseId, validateLessonId],
    },
    enrollmentController.toggleLessonBookmark,
  );

  // POST /api/enrollments/courses/:courseId/notes - Add or update notes for a course
  fastify.post(
    '/courses/:courseId/notes',
    {
      preHandler: [authPreHandler, validateCourseId],
      schema: {
        body: {
          type: 'object',
          required: ['notes'],
          properties: {
            notes: { type: 'string', description: 'Notes for the course' },
          },
        },
      },
    },
    enrollmentController.addCourseNotes,
  );

  // POST /api/enrollments/courses/:courseId/rating - Add rating and feedback for a course
  fastify.post(
    '/courses/:courseId/rating',
    {
      preHandler: [authPreHandler, validateCourseId],
      schema: {
        body: {
          type: 'object',
          required: ['rating'],
          properties: {
            rating: { type: 'number', minimum: 1, maximum: 5, description: 'Rating from 1 to 5' },
            feedback: { type: 'string', description: 'Feedback for the course' },
          },
        },
      },
    },
    enrollmentController.addCourseRating,
  );

  // GET /api/enrollments/courses/:courseId/students - Get all students enrolled in a course (for instructors/admins)
  fastify.get(
    '/courses/:courseId/students',
    {
      preHandler: [authPreHandler, validateCourseId],
    },
    enrollmentController.getCourseEnrollments,
  );

  // GET /api/enrollments/courses/:courseId/stats - Get course completion statistics (for instructors/admins)
  fastify.get(
    '/courses/:courseId/stats',
    {
      preHandler: [authPreHandler, validateCourseId],
    },
    enrollmentController.getCourseCompletionStats,
  );
}
