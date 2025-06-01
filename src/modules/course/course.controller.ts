import { FastifyReply, FastifyRequest } from 'fastify';
import { CourseService } from './course.service';
import {
  Course,
  CreateCoursePayload,
  UpdateCoursePayload,
  CreateModulePayload,
  UpdateModulePayload,
  CreateLessonPayload,
  UpdateLessonPayload,
  PaginatedCourseResponse,
  SuccessResponse,
} from './types';
import { NotFoundError, ValidationError } from '../../utils/errors';
import { asyncHandler } from '../../utils/middleware';

export class CourseController {
  constructor(private courseService: CourseService) {}

  // Course Handlers

  // Get all courses
  getAllCoursesHandler = asyncHandler(
    async (request: FastifyRequest, _reply: FastifyReply): Promise<PaginatedCourseResponse> => {
      const startTime = Date.now();
      const { page = 1, limit = 10 } = request.query as { page?: number; limit?: number };
      const requestId = request.id;

      // Log method entry with parameters
      request.log.info(
        {
          operation: 'getAllCourses',
          params: { page, limit },
          userId: (request as any).user?.id, // If you have user context
          requestId,
        },
        'Getting all courses',
      );

      try {
        // Pass request context to service for correlation
        const result = await this.courseService.getAllCoursesWithContext(page, limit, {
          requestId,
          userId: (request as any).user?.id,
        });

        const duration = Date.now() - startTime;

        // Log successful operation with metrics
        request.log.info(
          {
            operation: 'getAllCourses',
            success: true,
            duration,
            resultCount: result.courses.length,
            totalCourses: result.total,
            page,
            limit,
            requestId,
          },
          `Successfully retrieved ${result.courses.length} courses in ${duration}ms`,
        );

        return {
          courses: result.courses,
          total: result.total,
          page,
          limit,
        };
      } catch (error) {
        const duration = Date.now() - startTime;

        // Log error with context
        request.log.error(
          {
            operation: 'getAllCourses',
            success: false,
            duration,
            error: error instanceof Error ? error.message : 'Unknown error',
            errorType: error?.constructor?.name,
            params: { page, limit },
            requestId,
          },
          'Failed to retrieve courses',
        );

        throw error; // Re-throw to maintain error handling flow
      }
    },
  );

  // Get course by ID
  getCourseByIdHandler = asyncHandler(
    async (request: FastifyRequest, _reply: FastifyReply): Promise<Course> => {
      const startTime = Date.now();
      const { courseId } = request.params as { courseId: string };

      request.log.info(
        {
          operation: 'getCourseById',
          courseId,
          userId: (request as any).user?.id,
          requestId: request.id,
        },
        `Getting course by ID: ${courseId}`,
      );

      try {
        const course = await this.courseService.getCourseById(courseId);
        const duration = Date.now() - startTime;

        if (!course) {
          request.log.warn(
            {
              operation: 'getCourseById',
              courseId,
              found: false,
              duration,
              requestId: request.id,
            },
            `Course not found: ${courseId}`,
          );

          throw new NotFoundError('Course not found');
        }

        request.log.info(
          {
            operation: 'getCourseById',
            courseId,
            found: true,
            duration,
            courseTitle: course.title,
            requestId: request.id,
          },
          `Successfully retrieved course: ${course.title} in ${duration}ms`,
        );

        return course;
      } catch (error) {
        const duration = Date.now() - startTime;

        if (!(error instanceof NotFoundError)) {
          request.log.error(
            {
              operation: 'getCourseById',
              courseId,
              success: false,
              duration,
              error: error instanceof Error ? error.message : 'Unknown error',
              errorType: error?.constructor?.name,
              requestId: request.id,
            },
            `Failed to retrieve course: ${courseId}`,
          );
        }

        throw error;
      }
    },
  );

  // Create course
  createCourseHandler = asyncHandler(
    async (request: FastifyRequest, reply: FastifyReply): Promise<Course> => {
      const startTime = Date.now();
      const courseData = request.body as CreateCoursePayload;

      request.log.info(
        {
          operation: 'createCourse',
          courseTitle: courseData.title,
          category: courseData.category,
          difficulty: courseData.difficulty,
          instructor: courseData.instructor,
          userId: (request as any).user?.id,
          requestId: request.id,
        },
        `Creating new course: ${courseData.title}`,
      );

      try {
        // Validate required fields with detailed logging
        const validationErrors: string[] = [];
        if (!courseData.title) validationErrors.push('Title is required');
        if (!courseData.description) validationErrors.push('Description is required');
        if (!courseData.thumbnailUrl) validationErrors.push('Thumbnail is required');
        if (!courseData.instructor) validationErrors.push('Instructor is required');
        if (!courseData.category) validationErrors.push('Category is required');
        if (!courseData.difficulty) validationErrors.push('Difficulty is required');

        if (validationErrors.length > 0) {
          request.log.warn(
            {
              operation: 'createCourse',
              validationErrors,
              providedFields: Object.keys(courseData),
              requestId: request.id,
            },
            `Course creation validation failed: ${validationErrors.join(', ')}`,
          );

          throw new ValidationError(validationErrors[0]);
        }

        const newCourse = await this.courseService.createCourse(courseData);
        const duration = Date.now() - startTime;

        request.log.info(
          {
            operation: 'createCourse',
            success: true,
            courseId: newCourse._id,
            courseTitle: newCourse.title,
            category: newCourse.category,
            duration,
            requestId: request.id,
          },
          `Successfully created course: ${newCourse.title} (ID: ${newCourse._id}) in ${duration}ms`,
        );

        // Log business metrics
        request.log.info(
          {
            metric: 'course_created',
            courseId: newCourse._id,
            category: newCourse.category,
            difficulty: newCourse.difficulty,
            instructor: newCourse.instructor,
            timestamp: new Date().toISOString(),
          },
          'Course creation metric',
        );

        reply.code(201);
        return newCourse;
      } catch (error) {
        const duration = Date.now() - startTime;

        if (!(error instanceof ValidationError)) {
          request.log.error(
            {
              operation: 'createCourse',
              success: false,
              duration,
              error: error instanceof Error ? error.message : 'Unknown error',
              errorType: error?.constructor?.name,
              courseData: {
                title: courseData.title,
                category: courseData.category,
                // Don't log sensitive data
              },
              requestId: request.id,
            },
            'Failed to create course',
          );
        }

        throw error;
      }
    },
  );

  // Update course
  updateCourseHandler = asyncHandler(
    async (request: FastifyRequest, _reply: FastifyReply): Promise<Course> => {
      const startTime = Date.now();
      const { courseId } = request.params as { courseId: string };
      const courseData = request.body as UpdateCoursePayload;

      request.log.info(
        {
          operation: 'updateCourse',
          courseId,
          updateFields: Object.keys(courseData),
          userId: (request as any).user?.id,
          requestId: request.id,
        },
        `Updating course: ${courseId}`,
      );

      try {
        const updatedCourse = await this.courseService.updateCourse(courseId, courseData);
        const duration = Date.now() - startTime;

        if (!updatedCourse) {
          request.log.warn(
            {
              operation: 'updateCourse',
              courseId,
              found: false,
              duration,
              requestId: request.id,
            },
            `Course not found for update: ${courseId}`,
          );

          throw new NotFoundError('Course not found');
        }

        request.log.info(
          {
            operation: 'updateCourse',
            success: true,
            courseId,
            courseTitle: updatedCourse.title,
            updatedFields: Object.keys(courseData),
            duration,
            requestId: request.id,
          },
          `Successfully updated course: ${updatedCourse.title} in ${duration}ms`,
        );

        return updatedCourse;
      } catch (error) {
        const duration = Date.now() - startTime;

        if (!(error instanceof NotFoundError)) {
          request.log.error(
            {
              operation: 'updateCourse',
              courseId,
              success: false,
              duration,
              error: error instanceof Error ? error.message : 'Unknown error',
              errorType: error?.constructor?.name,
              updateFields: Object.keys(courseData),
              requestId: request.id,
            },
            `Failed to update course: ${courseId}`,
          );
        }

        throw error;
      }
    },
  );

  // Delete course
  deleteCourseHandler = asyncHandler(
    async (request: FastifyRequest, _reply: FastifyReply): Promise<SuccessResponse> => {
      const startTime = Date.now();
      const { courseId } = request.params as { courseId: string };

      request.log.warn(
        {
          operation: 'deleteCourse',
          courseId,
          userId: (request as any).user?.id,
          requestId: request.id,
        },
        `Attempting to delete course: ${courseId}`,
      );

      try {
        const result = await this.courseService.deleteCourse(courseId);
        const duration = Date.now() - startTime;

        if (!result) {
          request.log.warn(
            {
              operation: 'deleteCourse',
              courseId,
              found: false,
              duration,
              requestId: request.id,
            },
            `Course not found for deletion: ${courseId}`,
          );

          throw new NotFoundError('Course not found');
        }

        // Log critical business event
        request.log.warn(
          {
            operation: 'deleteCourse',
            success: true,
            courseId,
            duration,
            userId: (request as any).user?.id,
            timestamp: new Date().toISOString(),
            requestId: request.id,
          },
          `Successfully deleted course: ${courseId} in ${duration}ms`,
        );

        // Log business metrics for audit
        request.log.info(
          {
            metric: 'course_deleted',
            courseId,
            deletedBy: (request as any).user?.id,
            timestamp: new Date().toISOString(),
          },
          'Course deletion metric',
        );

        return { success: true };
      } catch (error) {
        const duration = Date.now() - startTime;

        if (!(error instanceof NotFoundError)) {
          request.log.error(
            {
              operation: 'deleteCourse',
              courseId,
              success: false,
              duration,
              error: error instanceof Error ? error.message : 'Unknown error',
              errorType: error?.constructor?.name,
              requestId: request.id,
            },
            `Failed to delete course: ${courseId}`,
          );
        }

        throw error;
      }
    },
  );

  // Curriculum Handlers

  // Get course curriculum
  getCurriculumHandler = asyncHandler(async (request: FastifyRequest, _reply: FastifyReply) => {
    const startTime = Date.now();
    const { courseId } = request.params as { courseId: string };

    request.log.info(
      {
        operation: 'getCurriculum',
        courseId,
        userId: (request as any).user?.id,
        requestId: request.id,
      },
      `Getting curriculum for course: ${courseId}`,
    );

    try {
      const curriculum = await this.courseService.getCurriculum(courseId);
      const duration = Date.now() - startTime;

      if (!curriculum) {
        request.log.warn(
          {
            operation: 'getCurriculum',
            courseId,
            found: false,
            duration,
            requestId: request.id,
          },
          `Course not found for curriculum: ${courseId}`,
        );

        throw new NotFoundError('Course not found');
      }

      const moduleCount = curriculum.modules?.length || 0;
      const lessonCount =
        curriculum.modules?.reduce((total, module) => total + (module.lessons?.length || 0), 0) ||
        0;

      request.log.info(
        {
          operation: 'getCurriculum',
          success: true,
          courseId,
          moduleCount,
          lessonCount,
          duration,
          requestId: request.id,
        },
        `Successfully retrieved curriculum for course: ${courseId} (${moduleCount} modules, ${lessonCount} lessons) in ${duration}ms`,
      );

      return curriculum;
    } catch (error) {
      const duration = Date.now() - startTime;

      if (!(error instanceof NotFoundError)) {
        request.log.error(
          {
            operation: 'getCurriculum',
            courseId,
            success: false,
            duration,
            error: error instanceof Error ? error.message : 'Unknown error',
            errorType: error?.constructor?.name,
            requestId: request.id,
          },
          `Failed to retrieve curriculum for course: ${courseId}`,
        );
      }

      throw error;
    }
  });

  // Module Handlers

  // Get module
  getModuleHandler = asyncHandler(async (request: FastifyRequest, _reply: FastifyReply) => {
    const startTime = Date.now();
    const { courseId, moduleId } = request.params as { courseId: string; moduleId: string };

    request.log.info(
      {
        operation: 'getModule',
        courseId,
        moduleId,
        userId: (request as any).user?.id,
        requestId: request.id,
      },
      `Getting module: ${moduleId} from course: ${courseId}`,
    );

    try {
      const module = await this.courseService.getModule(courseId, moduleId);
      const duration = Date.now() - startTime;

      if (!module) {
        request.log.warn(
          {
            operation: 'getModule',
            courseId,
            moduleId,
            found: false,
            duration,
            requestId: request.id,
          },
          `Module not found: ${moduleId} in course: ${courseId}`,
        );

        throw new NotFoundError('Module not found');
      }

      request.log.info(
        {
          operation: 'getModule',
          success: true,
          courseId,
          moduleId,
          moduleTitle: module.title,
          lessonCount: module.lessons?.length || 0,
          duration,
          requestId: request.id,
        },
        `Successfully retrieved module: ${module.title} in ${duration}ms`,
      );

      return module;
    } catch (error) {
      const duration = Date.now() - startTime;

      if (!(error instanceof NotFoundError)) {
        request.log.error(
          {
            operation: 'getModule',
            courseId,
            moduleId,
            success: false,
            duration,
            error: error instanceof Error ? error.message : 'Unknown error',
            errorType: error?.constructor?.name,
            requestId: request.id,
          },
          `Failed to retrieve module: ${moduleId} from course: ${courseId}`,
        );
      }

      throw error;
    }
  });

  // Create module
  createModuleHandler = asyncHandler(async (request: FastifyRequest, reply: FastifyReply) => {
    const startTime = Date.now();
    const { courseId } = request.params as { courseId: string };
    const moduleData = request.body as CreateModulePayload;

    request.log.info(
      {
        operation: 'createModule',
        courseId,
        moduleTitle: moduleData.title,
        moduleOrder: moduleData.order,
        userId: (request as any).user?.id,
        requestId: request.id,
      },
      `Creating module: ${moduleData.title} in course: ${courseId}`,
    );

    try {
      // Validate required fields
      const validationErrors: string[] = [];
      if (!moduleData.title) validationErrors.push('Title is required');
      if (moduleData.order === undefined) validationErrors.push('Order is required');

      if (validationErrors.length > 0) {
        request.log.warn(
          {
            operation: 'createModule',
            courseId,
            validationErrors,
            providedFields: Object.keys(moduleData),
            requestId: request.id,
          },
          `Module creation validation failed: ${validationErrors.join(', ')}`,
        );

        throw new ValidationError(validationErrors[0]);
      }

      const newModule = await this.courseService.createModule(courseId, moduleData);
      const duration = Date.now() - startTime;

      request.log.info(
        {
          operation: 'createModule',
          success: true,
          courseId,
          moduleId: newModule._id,
          moduleTitle: newModule.title,
          moduleOrder: newModule.order,
          duration,
          requestId: request.id,
        },
        `Successfully created module: ${newModule.title} (ID: ${newModule._id}) in ${duration}ms`,
      );

      reply.code(201);
      return newModule;
    } catch (error) {
      const duration = Date.now() - startTime;

      if (!(error instanceof ValidationError)) {
        request.log.error(
          {
            operation: 'createModule',
            courseId,
            success: false,
            duration,
            error: error instanceof Error ? error.message : 'Unknown error',
            errorType: error?.constructor?.name,
            moduleData: {
              title: moduleData.title,
              order: moduleData.order,
            },
            requestId: request.id,
          },
          `Failed to create module in course: ${courseId}`,
        );
      }

      throw error;
    }
  });

  // Update module
  updateModuleHandler = asyncHandler(async (request: FastifyRequest, _reply: FastifyReply) => {
    const startTime = Date.now();
    const { courseId, moduleId } = request.params as { courseId: string; moduleId: string };
    const moduleData = request.body as UpdateModulePayload;

    request.log.info(
      {
        operation: 'updateModule',
        courseId,
        moduleId,
        updateFields: Object.keys(moduleData),
        userId: (request as any).user?.id,
        requestId: request.id,
      },
      `Updating module: ${moduleId} in course: ${courseId}`,
    );

    try {
      const updatedModule = await this.courseService.updateModule(courseId, moduleId, moduleData);
      const duration = Date.now() - startTime;

      if (!updatedModule) {
        request.log.warn(
          {
            operation: 'updateModule',
            courseId,
            moduleId,
            found: false,
            duration,
            requestId: request.id,
          },
          `Module not found for update: ${moduleId} in course: ${courseId}`,
        );

        throw new NotFoundError('Module not found');
      }

      request.log.info(
        {
          operation: 'updateModule',
          success: true,
          courseId,
          moduleId,
          moduleTitle: updatedModule.title,
          updatedFields: Object.keys(moduleData),
          duration,
          requestId: request.id,
        },
        `Successfully updated module: ${updatedModule.title} in ${duration}ms`,
      );

      return updatedModule;
    } catch (error) {
      const duration = Date.now() - startTime;

      if (!(error instanceof NotFoundError)) {
        request.log.error(
          {
            operation: 'updateModule',
            courseId,
            moduleId,
            success: false,
            duration,
            error: error instanceof Error ? error.message : 'Unknown error',
            errorType: error?.constructor?.name,
            updateFields: Object.keys(moduleData),
            requestId: request.id,
          },
          `Failed to update module: ${moduleId} in course: ${courseId}`,
        );
      }

      throw error;
    }
  });

  // Delete module
  deleteModuleHandler = asyncHandler(
    async (request: FastifyRequest, _reply: FastifyReply): Promise<SuccessResponse> => {
      const startTime = Date.now();
      const { courseId, moduleId } = request.params as { courseId: string; moduleId: string };

      request.log.warn(
        {
          operation: 'deleteModule',
          courseId,
          moduleId,
          userId: (request as any).user?.id,
          requestId: request.id,
        },
        `Attempting to delete module: ${moduleId} from course: ${courseId}`,
      );

      try {
        const result = await this.courseService.deleteModule(courseId, moduleId);
        const duration = Date.now() - startTime;

        if (!result) {
          request.log.warn(
            {
              operation: 'deleteModule',
              courseId,
              moduleId,
              found: false,
              duration,
              requestId: request.id,
            },
            `Module not found for deletion: ${moduleId} in course: ${courseId}`,
          );

          throw new NotFoundError('Module not found');
        }

        request.log.warn(
          {
            operation: 'deleteModule',
            success: true,
            courseId,
            moduleId,
            duration,
            userId: (request as any).user?.id,
            timestamp: new Date().toISOString(),
            requestId: request.id,
          },
          `Successfully deleted module: ${moduleId} from course: ${courseId} in ${duration}ms`,
        );

        return { success: true };
      } catch (error) {
        const duration = Date.now() - startTime;

        if (!(error instanceof NotFoundError)) {
          request.log.error(
            {
              operation: 'deleteModule',
              courseId,
              moduleId,
              success: false,
              duration,
              error: error instanceof Error ? error.message : 'Unknown error',
              errorType: error?.constructor?.name,
              requestId: request.id,
            },
            `Failed to delete module: ${moduleId} from course: ${courseId}`,
          );
        }

        throw error;
      }
    },
  );

  // Lesson Handlers

  // Get lesson
  getLessonHandler = asyncHandler(async (request: FastifyRequest) => {
    const startTime = Date.now();
    const { courseId, moduleId, lessonId } = request.params as {
      courseId: string;
      moduleId: string;
      lessonId: string;
    };

    request.log.info(
      {
        operation: 'getLesson',
        courseId,
        moduleId,
        lessonId,
        userId: (request as any).user?.id,
        requestId: request.id,
      },
      `Getting lesson: ${lessonId} from module: ${moduleId} in course: ${courseId}`,
    );

    try {
      const lesson = await this.courseService.getLesson(courseId, moduleId, lessonId);
      const duration = Date.now() - startTime;

      if (!lesson) {
        request.log.warn(
          {
            operation: 'getLesson',
            courseId,
            moduleId,
            lessonId,
            found: false,
            duration,
            requestId: request.id,
          },
          `Lesson not found: ${lessonId} in module: ${moduleId} of course: ${courseId}`,
        );

        throw new NotFoundError('Lesson not found');
      }

      request.log.info(
        {
          operation: 'getLesson',
          success: true,
          courseId,
          moduleId,
          lessonId,
          lessonTitle: lesson.title,
          duration,
          requestId: request.id,
        },
        `Successfully retrieved lesson: ${lesson.title} in ${duration}ms`,
      );

      return lesson;
    } catch (error) {
      const duration = Date.now() - startTime;

      if (!(error instanceof NotFoundError)) {
        request.log.error(
          {
            operation: 'getLesson',
            courseId,
            moduleId,
            lessonId,
            success: false,
            duration,
            error: error instanceof Error ? error.message : 'Unknown error',
            errorType: error?.constructor?.name,
            requestId: request.id,
          },
          `Failed to retrieve lesson: ${lessonId} from module: ${moduleId} in course: ${courseId}`,
        );
      }

      throw error;
    }
  });

  // Create lesson
  createLessonHandler = asyncHandler(async (request: FastifyRequest, reply: FastifyReply) => {
    const startTime = Date.now();
    const { courseId, moduleId } = request.params as { courseId: string; moduleId: string };
    const lessonData = request.body as CreateLessonPayload;

    request.log.info(
      {
        operation: 'createLesson',
        courseId,
        moduleId,
        lessonTitle: lessonData.title,
        lessonOrder: lessonData.order,
        userId: (request as any).user?.id,
        requestId: request.id,
      },
      `Creating lesson: ${lessonData.title} in module: ${moduleId} of course: ${courseId}`,
    );

    try {
      // Validate required fields
      const validationErrors: string[] = [];
      if (!lessonData.title) validationErrors.push('Title is required');
      if (lessonData.order === undefined) validationErrors.push('Order is required');

      if (validationErrors.length > 0) {
        request.log.warn(
          {
            operation: 'createLesson',
            courseId,
            moduleId,
            validationErrors,
            providedFields: Object.keys(lessonData),
            requestId: request.id,
          },
          `Lesson creation validation failed: ${validationErrors.join(', ')}`,
        );

        throw new ValidationError(validationErrors[0]);
      }

      const newLesson = await this.courseService.createLesson(courseId, moduleId, lessonData);
      const duration = Date.now() - startTime;

      request.log.info(
        {
          operation: 'createLesson',
          success: true,
          courseId,
          moduleId,
          lessonId: newLesson._id,
          lessonTitle: newLesson.title,
          lessonOrder: newLesson.order,
          duration,
          requestId: request.id,
        },
        `Successfully created lesson: ${newLesson.title} (ID: ${newLesson._id}) in ${duration}ms`,
      );

      reply.code(201);
      return newLesson;
    } catch (error) {
      const duration = Date.now() - startTime;

      if (!(error instanceof ValidationError)) {
        request.log.error(
          {
            operation: 'createLesson',
            courseId,
            moduleId,
            success: false,
            duration,
            error: error instanceof Error ? error.message : 'Unknown error',
            errorType: error?.constructor?.name,
            lessonData: {
              title: lessonData.title,
              order: lessonData.order,
            },
            requestId: request.id,
          },
          `Failed to create lesson in module: ${moduleId} of course: ${courseId}`,
        );
      }

      throw error;
    }
  });

  // Update lesson
  updateLessonHandler = asyncHandler(async (request: FastifyRequest, _reply: FastifyReply) => {
    const startTime = Date.now();
    const { courseId, moduleId, lessonId } = request.params as {
      courseId: string;
      moduleId: string;
      lessonId: string;
    };
    const lessonData = request.body as UpdateLessonPayload;

    request.log.info(
      {
        operation: 'updateLesson',
        courseId,
        moduleId,
        lessonId,
        updateFields: Object.keys(lessonData),
        userId: (request as any).user?.id,
        requestId: request.id,
      },
      `Updating lesson: ${lessonId} in module: ${moduleId} of course: ${courseId}`,
    );

    try {
      const updatedLesson = await this.courseService.updateLesson(
        courseId,
        moduleId,
        lessonId,
        lessonData,
      );
      const duration = Date.now() - startTime;

      if (!updatedLesson) {
        request.log.warn(
          {
            operation: 'updateLesson',
            courseId,
            moduleId,
            lessonId,
            found: false,
            duration,
            requestId: request.id,
          },
          `Lesson not found for update: ${lessonId} in module: ${moduleId} of course: ${courseId}`,
        );

        throw new NotFoundError('Lesson not found');
      }

      request.log.info(
        {
          operation: 'updateLesson',
          success: true,
          courseId,
          moduleId,
          lessonId,
          lessonTitle: updatedLesson.title,
          updatedFields: Object.keys(lessonData),
          duration,
          requestId: request.id,
        },
        `Successfully updated lesson: ${updatedLesson.title} in ${duration}ms`,
      );

      return updatedLesson;
    } catch (error) {
      const duration = Date.now() - startTime;

      if (!(error instanceof NotFoundError)) {
        request.log.error(
          {
            operation: 'updateLesson',
            courseId,
            moduleId,
            lessonId,
            success: false,
            duration,
            error: error instanceof Error ? error.message : 'Unknown error',
            errorType: error?.constructor?.name,
            updateFields: Object.keys(lessonData),
            requestId: request.id,
          },
          `Failed to update lesson: ${lessonId} in module: ${moduleId} of course: ${courseId}`,
        );
      }

      throw error;
    }
  });

  // Delete lesson
  deleteLessonHandler = asyncHandler(
    async (request: FastifyRequest, _reply: FastifyReply): Promise<SuccessResponse> => {
      const startTime = Date.now();
      const { courseId, moduleId, lessonId } = request.params as {
        courseId: string;
        moduleId: string;
        lessonId: string;
      };

      request.log.warn(
        {
          operation: 'deleteLesson',
          courseId,
          moduleId,
          lessonId,
          userId: (request as any).user?.id,
          requestId: request.id,
        },
        `Attempting to delete lesson: ${lessonId} from module: ${moduleId} in course: ${courseId}`,
      );

      try {
        const result = await this.courseService.deleteLesson(courseId, moduleId, lessonId);
        const duration = Date.now() - startTime;

        if (!result) {
          request.log.warn(
            {
              operation: 'deleteLesson',
              courseId,
              moduleId,
              lessonId,
              found: false,
              duration,
              requestId: request.id,
            },
            `Lesson not found for deletion: ${lessonId} in module: ${moduleId} of course: ${courseId}`,
          );

          throw new NotFoundError('Lesson not found');
        }

        request.log.warn(
          {
            operation: 'deleteLesson',
            success: true,
            courseId,
            moduleId,
            lessonId,
            duration,
            userId: (request as any).user?.id,
            timestamp: new Date().toISOString(),
            requestId: request.id,
          },
          `Successfully deleted lesson: ${lessonId} from module: ${moduleId} in course: ${courseId} in ${duration}ms`,
        );

        return { success: true };
      } catch (error) {
        const duration = Date.now() - startTime;

        if (!(error instanceof NotFoundError)) {
          request.log.error(
            {
              operation: 'deleteLesson',
              courseId,
              moduleId,
              lessonId,
              success: false,
              duration,
              error: error instanceof Error ? error.message : 'Unknown error',
              errorType: error?.constructor?.name,
              requestId: request.id,
            },
            `Failed to delete lesson: ${lessonId} from module: ${moduleId} in course: ${courseId}`,
          );
        }

        throw error;
      }
    },
  );
}
