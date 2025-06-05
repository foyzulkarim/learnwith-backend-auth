import { FastifyInstance } from 'fastify';
import { EnrollmentHelpers, LessonProgress } from './enrollment.model';
import { getCourseModel } from '../course/course.model';
import { createLogger, Logger } from '../../utils/logger';
import { NotFoundError } from '../../utils/errors';

export class EnrollmentService {
  private courseModel;
  private logger: Logger;

  constructor(private fastify: FastifyInstance) {
    this.courseModel = getCourseModel();
    this.logger = createLogger(fastify);
  }

  /**
   * Enroll a user in a course with a single click
   */
  async enrollUserInCourse(userId: string, courseId: string) {
    const logContext = this.logger.startOperation('EnrollmentService.enrollUserInCourse', {
      userId,
      courseId,
    });

    try {
      // Check if the course exists
      const course = await this.courseModel.findById(courseId);
      if (!course) {
        this.logger.warn(
          {
            operation: 'EnrollmentService.enrollUserInCourse',
            courseId,
            userId,
            found: false,
          },
          `Course not found for enrollment: ${courseId}`,
        );
        throw new NotFoundError('Course not found');
      }

      // Enroll the user
      const enrollment = await EnrollmentHelpers.enrollUserInCourse(userId, courseId);

      // Increment student count in the course
      course.studentCount += 1;
      await course.save();

      // Log success
      this.logger.endOperation(
        logContext,
        `Successfully enrolled user ${userId} in course: ${course.title}`,
        {
          courseId,
          courseTitle: course.title,
          userId,
        },
      );

      // Return enrollment details with course info
      return {
        enrolled: true,
        enrolledAt: enrollment.enrolledAt,
        lastAccessedAt: enrollment.lastAccessedAt,
        lastWatchedLessonId: enrollment.lastWatchedLessonId
          ? enrollment.lastWatchedLessonId.toString()
          : null,
        completedLessons: Array.from(enrollment.lessons.values()).filter(
          (value): value is LessonProgress => {
            const lesson = value as LessonProgress;
            return lesson.status === 'completed';
          },
        ).length,
        progress: enrollment.progress,
        course: {
          _id: course._id.toString(),
          title: course.title,
          thumbnailUrl: course.thumbnailUrl,
          totalLessons: course.totalLessons,
        },
      };
    } catch (error) {
      // Log error
      this.logger.errorOperation(
        logContext,
        error,
        `Failed to enroll user ${userId} in course ${courseId}`,
        {
          userId,
          courseId,
        },
      );
      throw error;
    }
  }

  /**
   * Get all courses a user is enrolled in
   */
  async getUserEnrollments(userId: string) {
    const logContext = this.logger.startOperation('EnrollmentService.getUserEnrollments', {
      userId,
    });

    try {
      // Get all enrollments for the user
      const enrollments = await EnrollmentHelpers.getUserEnrollments(userId);

      // Get course details for each enrollment
      const enrolledCourses = await Promise.all(
        enrollments.map(async (enrollment) => {
          const course = await this.courseModel.findById(enrollment.courseId).lean();
          if (!course) return null;

          const completedLessons = Array.from(enrollment.lessons.values()).filter(
            (value): value is LessonProgress => {
              const lesson = value as LessonProgress;
              return lesson.status === 'completed';
            },
          ).length;

          return {
            _id: course._id.toString(),
            title: course.title,
            thumbnailUrl: course.thumbnailUrl,
            instructor: course.instructor,
            totalLessons: course.totalLessons,
            enrolledAt: enrollment.enrolledAt,
            lastAccessedAt: enrollment.lastAccessedAt,
            lastWatchedLessonId: enrollment.lastWatchedLessonId
              ? enrollment.lastWatchedLessonId.toString()
              : null,
            completedLessons: completedLessons,
            progress: enrollment.progress,
          };
        }),
      );

      // Filter out null values (courses that might have been deleted)
      const validEnrollments = enrolledCourses.filter(Boolean);

      this.logger.endOperation(
        logContext,
        `Successfully retrieved ${validEnrollments.length} enrollments for user ${userId}`,
        {
          userId,
          enrollmentCount: validEnrollments.length,
        },
      );

      return validEnrollments;
    } catch (error) {
      this.logger.errorOperation(
        logContext,
        error,
        `Failed to retrieve enrollments for user ${userId}`,
        {
          userId,
        },
      );
      throw error;
    }
  }

  /**
   * Check if a user is enrolled in a course
   */
  async isUserEnrolled(userId: string, courseId: string) {
    try {
      const isEnrolled = await EnrollmentHelpers.isUserEnrolled(userId, courseId);
      return { enrolled: isEnrolled };
    } catch (error) {
      this.logger.error(
        {
          operation: 'EnrollmentService.isUserEnrolled',
          userId,
          courseId,
          error: error instanceof Error ? error.message : 'Unknown error',
        },
        `Failed to check enrollment status for user ${userId} in course ${courseId}`,
      );
      throw error;
    }
  }

  /**
   * Get enrollment details for a user in a course
   */
  async getEnrollmentDetails(userId: string, courseId: string) {
    try {
      const course = await this.courseModel.findById(courseId).lean();
      if (!course) {
        throw new NotFoundError('Course not found');
      }

      const enrollmentDetails = await EnrollmentHelpers.getEnrollmentDetails(userId, courseId);

      if (!enrollmentDetails) {
        return {
          enrolled: false,
          course: {
            _id: course._id.toString(),
            title: course.title,
            thumbnailUrl: course.thumbnailUrl,
            totalLessons: course.totalLessons,
          },
        };
      }

      return {
        ...enrollmentDetails,
        course: {
          _id: course._id.toString(),
          title: course.title,
          thumbnailUrl: course.thumbnailUrl,
          totalLessons: course.totalLessons,
        },
      };
    } catch (error) {
      this.logger.error(
        {
          operation: 'EnrollmentService.getEnrollmentDetails',
          userId,
          courseId,
          error: error instanceof Error ? error.message : 'Unknown error',
        },
        `Failed to get enrollment details for user ${userId} in course ${courseId}`,
      );
      throw error;
    }
  }

  /**
   * Update the last watched lesson for a user
   */
  async updateLastWatchedLesson(
    userId: string,
    courseId: string,
    lessonId: string,
    duration?: number,
  ) {
    const logContext = this.logger.startOperation('EnrollmentService.updateLastWatchedLesson', {
      userId,
      courseId,
      lessonId,
    });

    try {
      const enrollment = await EnrollmentHelpers.updateLastWatchedLesson(
        userId,
        courseId,
        lessonId,
        duration,
      );

      this.logger.endOperation(
        logContext,
        `Successfully updated last watched lesson for user ${userId} in course ${courseId}`,
        {
          userId,
          courseId,
          lessonId,
        },
      );

      // Convert lessons Map to a more JSON-friendly format for the specific lesson
      const lessonProgress = enrollment.lessons.get(lessonId);

      return {
        lastWatchedLessonId: enrollment.lastWatchedLessonId.toString(),
        lastAccessedAt: enrollment.lastAccessedAt,
        lessonProgress: lessonProgress
          ? {
              ...lessonProgress.toObject(),
              lessonId: lessonProgress.lessonId.toString(),
            }
          : null,
      };
    } catch (error) {
      this.logger.errorOperation(
        logContext,
        error,
        `Failed to update last watched lesson for user ${userId} in course ${courseId}`,
        {
          userId,
          courseId,
          lessonId,
        },
      );
      throw error;
    }
  }

  /**
   * Mark a lesson as completed
   */
  async markLessonAsCompleted(userId: string, courseId: string, lessonId: string) {
    const logContext = this.logger.startOperation('EnrollmentService.markLessonAsCompleted', {
      userId,
      courseId,
      lessonId,
    });

    try {
      // Get the course to determine total lessons
      const course = await this.courseModel.findById(courseId);
      if (!course) {
        throw new NotFoundError('Course not found');
      }

      const enrollment = await EnrollmentHelpers.markLessonAsCompleted(
        userId,
        courseId,
        lessonId,
        course.totalLessons,
      );

      // Convert lessons Map to a more JSON-friendly format for the specific lesson
      const lessonProgress = enrollment.lessons.get(lessonId);

      this.logger.endOperation(
        logContext,
        `Successfully marked lesson as completed for user ${userId} in course ${courseId}`,
        {
          userId,
          courseId,
          lessonId,
          progress: enrollment.progress,
        },
      );

      return {
        progress: enrollment.progress,
        lastAccessedAt: enrollment.lastAccessedAt,
        completedLessons: Array.from(enrollment.lessons.values()).filter(
          (value): value is LessonProgress => {
            const lesson = value as LessonProgress;
            return lesson.status === 'completed';
          },
        ).length,
        lessonProgress: lessonProgress
          ? {
              ...lessonProgress.toObject(),
              lessonId: lessonProgress.lessonId.toString(),
            }
          : null,
      };
    } catch (error) {
      this.logger.errorOperation(
        logContext,
        error,
        `Failed to mark lesson as completed for user ${userId} in course ${courseId}`,
        {
          userId,
          courseId,
          lessonId,
        },
      );
      throw error;
    }
  }

  /**
   * Update lesson notes
   */
  async updateLessonNotes(userId: string, courseId: string, lessonId: string, notes: string) {
    const logContext = this.logger.startOperation('EnrollmentService.updateLessonNotes', {
      userId,
      courseId,
      lessonId,
    });

    try {
      const enrollment = await EnrollmentHelpers.updateLessonNotes(
        userId,
        courseId,
        lessonId,
        notes,
      );

      // Convert lessons Map to a more JSON-friendly format for the specific lesson
      const lessonProgress = enrollment.lessons.get(lessonId);

      this.logger.endOperation(
        logContext,
        `Successfully updated lesson notes for user ${userId} in course ${courseId}, lesson ${lessonId}`,
        {
          userId,
          courseId,
          lessonId,
        },
      );

      return {
        lastAccessedAt: enrollment.lastAccessedAt,
        lessonProgress: lessonProgress
          ? {
              ...lessonProgress.toObject(),
              lessonId: lessonProgress.lessonId.toString(),
            }
          : null,
      };
    } catch (error) {
      this.logger.errorOperation(
        logContext,
        error,
        `Failed to update lesson notes for user ${userId} in course ${courseId}, lesson ${lessonId}`,
        {
          userId,
          courseId,
          lessonId,
        },
      );
      throw error;
    }
  }

  /**
   * Toggle lesson bookmark
   */
  async toggleLessonBookmark(userId: string, courseId: string, lessonId: string) {
    const logContext = this.logger.startOperation('EnrollmentService.toggleLessonBookmark', {
      userId,
      courseId,
      lessonId,
    });

    try {
      const enrollment = await EnrollmentHelpers.toggleLessonBookmark(userId, courseId, lessonId);

      // Convert lessons Map to a more JSON-friendly format for the specific lesson
      const lessonProgress = enrollment.lessons.get(lessonId);

      this.logger.endOperation(
        logContext,
        `Successfully toggled lesson bookmark for user ${userId} in course ${courseId}, lesson ${lessonId}`,
        {
          userId,
          courseId,
          lessonId,
        },
      );

      return {
        lastAccessedAt: enrollment.lastAccessedAt,
        lessonProgress: lessonProgress
          ? {
              ...lessonProgress.toObject(),
              lessonId: lessonProgress.lessonId.toString(),
            }
          : null,
      };
    } catch (error) {
      this.logger.errorOperation(
        logContext,
        error,
        `Failed to toggle lesson bookmark for user ${userId} in course ${courseId}, lesson ${lessonId}`,
        {
          userId,
          courseId,
          lessonId,
        },
      );
      throw error;
    }
  }

  /**
   * Get the first lesson of a course or the last watched lesson
   */
  async getResumeLesson(userId: string, courseId: string) {
    try {
      // Check if the course exists
      const course = await this.courseModel.findById(courseId).lean();
      if (!course) {
        throw new NotFoundError('Course not found');
      }

      // Get the last watched lesson ID
      const lastWatchedLessonId = await EnrollmentHelpers.getLastWatchedLesson(userId, courseId);

      // If there's a last watched lesson, return it
      if (lastWatchedLessonId) {
        // Find the module and lesson
        for (const module of course.modules) {
          for (const lesson of module.lessons) {
            if (lesson._id.toString() === lastWatchedLessonId) {
              return {
                courseId: course._id.toString(),
                moduleId: module._id.toString(),
                lessonId: lesson._id.toString(),
                title: lesson.title,
              };
            }
          }
        }
      }

      // If no last watched lesson or it wasn't found, return the first lesson
      if (course.modules.length > 0 && course.modules[0].lessons.length > 0) {
        const firstModule = course.modules[0];
        const firstLesson = firstModule.lessons[0];

        return {
          courseId: course._id.toString(),
          moduleId: firstModule._id.toString(),
          lessonId: firstLesson._id.toString(),
          title: firstLesson.title,
        };
      }

      // No lessons available
      return null;
    } catch (error) {
      this.logger.error(
        {
          operation: 'EnrollmentService.getResumeLesson',
          userId,
          courseId,
          error: error instanceof Error ? error.message : 'Unknown error',
        },
        `Failed to get resume lesson for user ${userId} in course ${courseId}`,
      );
      throw error;
    }
  }

  /**
   * Get all lesson progress for a course
   */
  async getLessonProgress(userId: string, courseId: string) {
    try {
      const lessonProgress = await EnrollmentHelpers.getLessonProgress(userId, courseId);

      if (!lessonProgress) {
        return null;
      }

      return lessonProgress;
    } catch (error) {
      this.logger.error(
        {
          operation: 'EnrollmentService.getLessonProgress',
          userId,
          courseId,
          error: error instanceof Error ? error.message : 'Unknown error',
        },
        `Failed to get lesson progress for user ${userId} in course ${courseId}`,
      );
      throw error;
    }
  }

  /**
   * Add or update notes for a course
   */
  async addCourseNotes(userId: string, courseId: string, notes: string) {
    const logContext = this.logger.startOperation('EnrollmentService.addCourseNotes', {
      userId,
      courseId,
    });

    try {
      const enrollment = await EnrollmentHelpers.addCourseNotes(userId, courseId, notes);

      this.logger.endOperation(
        logContext,
        `Successfully added notes for user ${userId} in course ${courseId}`,
        {
          userId,
          courseId,
        },
      );

      return {
        notes: enrollment.notes,
        lastAccessedAt: enrollment.lastAccessedAt,
      };
    } catch (error) {
      this.logger.errorOperation(
        logContext,
        error,
        `Failed to add notes for user ${userId} in course ${courseId}`,
        {
          userId,
          courseId,
        },
      );
      throw error;
    }
  }

  /**
   * Add rating and feedback for a course
   */
  async addCourseRating(userId: string, courseId: string, rating: number, feedback?: string) {
    const logContext = this.logger.startOperation('EnrollmentService.addCourseRating', {
      userId,
      courseId,
      rating,
    });

    try {
      const enrollment = await EnrollmentHelpers.addCourseRating(
        userId,
        courseId,
        rating,
        feedback,
      );

      this.logger.endOperation(
        logContext,
        `Successfully added rating for user ${userId} in course ${courseId}`,
        {
          userId,
          courseId,
          rating,
        },
      );

      return {
        rating: enrollment.rating,
        feedback: enrollment.feedback,
        lastAccessedAt: enrollment.lastAccessedAt,
      };
    } catch (error) {
      this.logger.errorOperation(
        logContext,
        error,
        `Failed to add rating for user ${userId} in course ${courseId}`,
        {
          userId,
          courseId,
          rating,
        },
      );
      throw error;
    }
  }

  /**
   * Issue a certificate for a completed course
   */
  async issueCertificate(userId: string, courseId: string, certificateUrl: string) {
    const logContext = this.logger.startOperation('EnrollmentService.issueCertificate', {
      userId,
      courseId,
    });

    try {
      const enrollment = await EnrollmentHelpers.issueCertificate(userId, courseId, certificateUrl);

      this.logger.endOperation(
        logContext,
        `Successfully issued certificate for user ${userId} in course ${courseId}`,
        {
          userId,
          courseId,
          certificateUrl,
        },
      );

      return {
        certificateIssued: enrollment.certificateIssued,
        certificateUrl: enrollment.certificateUrl,
        certificateIssuedAt: enrollment.certificateIssuedAt,
      };
    } catch (error) {
      this.logger.errorOperation(
        logContext,
        error,
        `Failed to issue certificate for user ${userId} in course ${courseId}`,
        {
          userId,
          courseId,
        },
      );
      throw error;
    }
  }

  /**
   * Get all students enrolled in a course (for instructors/admins)
   */
  async getCourseEnrollments(userId: string, courseId: string) {
    const logContext = this.logger.startOperation('EnrollmentService.getCourseEnrollments', {
      userId,
      courseId,
    });

    try {
      // Check if the user is an admin or the course instructor
      const course = await this.courseModel.findById(courseId);
      if (!course) {
        throw new NotFoundError('Course not found');
      }

      // TODO: Add proper authorization check here
      // For now, we'll just check if the user is an admin or the course instructor
      // This should be replaced with proper role-based access control

      const enrollments = await EnrollmentHelpers.getCourseEnrollments(courseId);

      this.logger.endOperation(
        logContext,
        `Successfully retrieved ${enrollments.length} enrollments for course ${courseId}`,
        {
          userId,
          courseId,
          enrollmentCount: enrollments.length,
        },
      );

      return enrollments;
    } catch (error) {
      this.logger.errorOperation(
        logContext,
        error,
        `Failed to retrieve enrollments for course ${courseId}`,
        {
          userId,
          courseId,
        },
      );
      throw error;
    }
  }

  /**
   * Get course completion statistics (for instructors/admins)
   */
  async getCourseCompletionStats(userId: string, courseId: string) {
    const logContext = this.logger.startOperation('EnrollmentService.getCourseCompletionStats', {
      userId,
      courseId,
    });

    try {
      // Check if the user is an admin or the course instructor
      const course = await this.courseModel.findById(courseId);
      if (!course) {
        throw new NotFoundError('Course not found');
      }

      // TODO: Add proper authorization check here
      // For now, we'll just check if the user is an admin or the course instructor
      // This should be replaced with proper role-based access control

      const stats = await EnrollmentHelpers.getCourseCompletionStats(courseId);

      this.logger.endOperation(
        logContext,
        `Successfully retrieved completion stats for course ${courseId}`,
        {
          userId,
          courseId,
          stats,
        },
      );

      return stats;
    } catch (error) {
      this.logger.errorOperation(
        logContext,
        error,
        `Failed to retrieve completion stats for course ${courseId}`,
        {
          userId,
          courseId,
        },
      );
      throw error;
    }
  }
}
