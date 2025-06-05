import { FastifyRequest, FastifyReply } from 'fastify';
import { EnrollmentService } from './enrollment.service';

export class EnrollmentController {
  constructor(private enrollmentService: EnrollmentService) {}

  /**
   * Enroll a user in a course
   */
  enrollUserInCourse = async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { courseId } = request.params as { courseId: string };
      const userId = request.user?.id;

      if (!userId) {
        return reply.status(401).send({ error: 'Unauthorized' });
      }

      const enrollment = await this.enrollmentService.enrollUserInCourse(userId, courseId);
      return reply.status(200).send(enrollment);
    } catch (error: any) {
      request.log.error(error);
      if (error?.message === 'Course not found') {
        return reply.status(404).send({ error: 'Course not found' });
      }
      return reply.status(500).send({ error: 'Internal Server Error' });
    }
  };

  /**
   * Get all courses a user is enrolled in
   */
  getUserEnrollments = async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const userId = request.user?.id;

      if (!userId) {
        return reply.status(401).send({ error: 'Unauthorized' });
      }

      const enrollments = await this.enrollmentService.getUserEnrollments(userId);
      return reply.status(200).send(enrollments);
    } catch (error) {
      request.log.error(error);
      return reply.status(500).send({ error: 'Internal Server Error' });
    }
  };

  /**
   * Check if a user is enrolled in a course
   */
  isUserEnrolled = async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { courseId } = request.params as { courseId: string };
      const userId = request.user?.id;

      if (!userId) {
        return reply.status(401).send({ error: 'Unauthorized' });
      }

      const isEnrolled = await this.enrollmentService.isUserEnrolled(userId, courseId);
      return reply.status(200).send(isEnrolled);
    } catch (error) {
      request.log.error(error);
      return reply.status(500).send({ error: 'Internal Server Error' });
    }
  };

  /**
   * Get enrollment details for a user in a course
   */
  getEnrollmentDetails = async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { courseId } = request.params as { courseId: string };
      const userId = request.user?.id;

      if (!userId) {
        return reply.status(401).send({ error: 'Unauthorized' });
      }

      const enrollmentDetails = await this.enrollmentService.getEnrollmentDetails(userId, courseId);
      return reply.status(200).send(enrollmentDetails);
    } catch (error: any) {
      request.log.error(error);
      if (error?.message === 'Course not found') {
        return reply.status(404).send({ error: 'Course not found' });
      }
      return reply.status(500).send({ error: 'Internal Server Error' });
    }
  };

  /**
   * Update the last watched lesson for a user
   */
  updateLastWatchedLesson = async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { courseId, lessonId } = request.params as { courseId: string; lessonId: string };
      const { duration } = request.body as { duration?: number };
      const userId = request.user?.id;

      if (!userId) {
        return reply.status(401).send({ error: 'Unauthorized' });
      }

      const result = await this.enrollmentService.updateLastWatchedLesson(
        userId,
        courseId,
        lessonId,
        duration,
      );
      return reply.status(200).send(result);
    } catch (error) {
      request.log.error(error);
      return reply.status(500).send({ error: 'Internal Server Error' });
    }
  };

  /**
   * Mark a lesson as completed
   */
  markLessonAsCompleted = async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { courseId, lessonId } = request.params as { courseId: string; lessonId: string };
      const userId = request.user?.id;

      if (!userId) {
        return reply.status(401).send({ error: 'Unauthorized' });
      }

      const result = await this.enrollmentService.markLessonAsCompleted(userId, courseId, lessonId);
      return reply.status(200).send(result);
    } catch (error) {
      request.log.error(error);
      return reply.status(500).send({ error: 'Internal Server Error' });
    }
  };

  /**
   * Update lesson notes
   */
  updateLessonNotes = async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { courseId, lessonId } = request.params as { courseId: string; lessonId: string };
      const { notes } = request.body as { notes: string };
      const userId = request.user?.id;

      if (!userId) {
        return reply.status(401).send({ error: 'Unauthorized' });
      }

      if (!notes) {
        return reply.status(400).send({ error: 'Notes are required' });
      }

      const result = await this.enrollmentService.updateLessonNotes(
        userId,
        courseId,
        lessonId,
        notes,
      );
      return reply.status(200).send(result);
    } catch (error: any) {
      request.log.error(error);
      if (error?.message === 'User is not enrolled in this course') {
        return reply.status(400).send({ error: 'User is not enrolled in this course' });
      }
      return reply.status(500).send({ error: 'Internal Server Error' });
    }
  };

  /**
   * Toggle lesson bookmark
   */
  toggleLessonBookmark = async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { courseId, lessonId } = request.params as { courseId: string; lessonId: string };
      const userId = request.user?.id;

      if (!userId) {
        return reply.status(401).send({ error: 'Unauthorized' });
      }

      const result = await this.enrollmentService.toggleLessonBookmark(userId, courseId, lessonId);
      return reply.status(200).send(result);
    } catch (error: any) {
      request.log.error(error);
      if (error?.message === 'User is not enrolled in this course') {
        return reply.status(400).send({ error: 'User is not enrolled in this course' });
      }
      return reply.status(500).send({ error: 'Internal Server Error' });
    }
  };

  /**
   * Get the first lesson of a course or the last watched lesson
   */
  getResumeLesson = async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { courseId } = request.params as { courseId: string };
      const userId = request.user?.id;

      if (!userId) {
        return reply.status(401).send({ error: 'Unauthorized' });
      }

      const lesson = await this.enrollmentService.getResumeLesson(userId, courseId);

      if (!lesson) {
        return reply.status(404).send({ error: 'No lessons available in this course' });
      }

      return reply.status(200).send(lesson);
    } catch (error: any) {
      request.log.error(error);
      if (error?.message === 'Course not found') {
        return reply.status(404).send({ error: 'Course not found' });
      }
      return reply.status(500).send({ error: 'Internal Server Error' });
    }
  };

  /**
   * Get all lesson progress for a course
   */
  getLessonProgress = async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { courseId } = request.params as { courseId: string };
      const userId = request.user?.id;

      if (!userId) {
        return reply.status(401).send({ error: 'Unauthorized' });
      }

      const lessonProgress = await this.enrollmentService.getLessonProgress(userId, courseId);

      if (!lessonProgress) {
        return reply.status(404).send({ error: 'No lesson progress found for this course' });
      }

      return reply.status(200).send(lessonProgress);
    } catch (error) {
      request.log.error(error);
      return reply.status(500).send({ error: 'Internal Server Error' });
    }
  };

  /**
   * Add or update notes for a course
   */
  addCourseNotes = async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { courseId } = request.params as { courseId: string };
      const { notes } = request.body as { notes: string };
      const userId = request.user?.id;

      if (!userId) {
        return reply.status(401).send({ error: 'Unauthorized' });
      }

      if (!notes) {
        return reply.status(400).send({ error: 'Notes are required' });
      }

      const result = await this.enrollmentService.addCourseNotes(userId, courseId, notes);
      return reply.status(200).send(result);
    } catch (error: any) {
      request.log.error(error);
      if (error?.message === 'User is not enrolled in this course') {
        return reply.status(400).send({ error: 'User is not enrolled in this course' });
      }
      return reply.status(500).send({ error: 'Internal Server Error' });
    }
  };

  /**
   * Add rating and feedback for a course
   */
  addCourseRating = async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { courseId } = request.params as { courseId: string };
      const { rating, feedback } = request.body as { rating: number; feedback?: string };
      const userId = request.user?.id;

      if (!userId) {
        return reply.status(401).send({ error: 'Unauthorized' });
      }

      if (!rating || rating < 1 || rating > 5) {
        return reply.status(400).send({ error: 'Rating must be between 1 and 5' });
      }

      const result = await this.enrollmentService.addCourseRating(
        userId,
        courseId,
        rating,
        feedback,
      );
      return reply.status(200).send(result);
    } catch (error: any) {
      request.log.error(error);
      if (error?.message === 'User is not enrolled in this course') {
        return reply.status(400).send({ error: 'User is not enrolled in this course' });
      }
      return reply.status(500).send({ error: 'Internal Server Error' });
    }
  };

  /**
   * Get all students enrolled in a course (for instructors/admins)
   */
  getCourseEnrollments = async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { courseId } = request.params as { courseId: string };
      const userId = request.user?.id;

      if (!userId) {
        return reply.status(401).send({ error: 'Unauthorized' });
      }

      const enrollments = await this.enrollmentService.getCourseEnrollments(userId, courseId);
      return reply.status(200).send(enrollments);
    } catch (error: any) {
      request.log.error(error);
      if (error?.message === 'Course not found') {
        return reply.status(404).send({ error: 'Course not found' });
      }
      if (error?.message === 'Unauthorized') {
        return reply.status(403).send({ error: 'Forbidden' });
      }
      return reply.status(500).send({ error: 'Internal Server Error' });
    }
  };

  /**
   * Get course completion statistics (for instructors/admins)
   */
  getCourseCompletionStats = async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { courseId } = request.params as { courseId: string };
      const userId = request.user?.id;

      if (!userId) {
        return reply.status(401).send({ error: 'Unauthorized' });
      }

      const stats = await this.enrollmentService.getCourseCompletionStats(userId, courseId);
      return reply.status(200).send(stats);
    } catch (error: any) {
      request.log.error(error);
      if (error?.message === 'Course not found') {
        return reply.status(404).send({ error: 'Course not found' });
      }
      if (error?.message === 'Unauthorized') {
        return reply.status(403).send({ error: 'Forbidden' });
      }
      return reply.status(500).send({ error: 'Internal Server Error' });
    }
  };
}
