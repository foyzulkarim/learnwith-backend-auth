import { FastifyInstance } from 'fastify';
import { getCourseModel, CourseHelpers } from './course.model';
import {
  Course,
  CreateCoursePayload,
  UpdateCoursePayload,
  CreateModulePayload,
  UpdateModulePayload,
  CreateLessonPayload,
  UpdateLessonPayload,
} from './types';
import { NotFoundError } from '../../utils/errors';
import { createLogger, Logger } from '../../utils/logger';
import { CourseValidationHelpers } from '../../utils/courseHelpers';

export class CourseService {
  private courseModel;
  private logger: Logger;

  constructor(private fastify: FastifyInstance) {
    this.courseModel = getCourseModel();
    this.logger = createLogger(fastify);
  }

  async getAllCourses(page: number = 1, limit: number = 10) {
    const startTime = Date.now();

    this.fastify.log.info(
      {
        operation: 'CourseService.getAllCourses',
        params: { page, limit },
      },
      `Getting all courses with pagination: page=${page}, limit=${limit}`,
    );

    try {
      // Calculate skip value for pagination
      const skip = (page - 1) * limit;

      // Get total count for pagination
      const total = await this.courseModel.countDocuments();

      this.fastify.log.debug(
        {
          operation: 'CourseService.getAllCourses',
          totalCount: total,
          skip,
          limit,
        },
        `Found ${total} total courses, fetching with skip=${skip}`,
      );

      // Get courses with pagination
      const courses = await this.courseModel
        .find()
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean();

      const duration = Date.now() - startTime;

      this.fastify.log.info(
        {
          operation: 'CourseService.getAllCourses',
          success: true,
          duration,
          resultCount: courses.length,
          totalCourses: total,
          page,
          limit,
        },
        `Successfully retrieved ${courses.length} courses in ${duration}ms`,
      );

      return {
        courses: courses.map((course) => ({
          ...course,
          _id: course._id.toString(),
          modules: course.modules.map((module) => ({
            ...module,
            _id: module._id.toString(),
            lessons: module.lessons.map((lesson) => ({
              ...lesson,
              _id: lesson._id.toString(),
            })),
          })),
        })) as Course[],
        total,
      };
    } catch (error) {
      const duration = Date.now() - startTime;

      this.fastify.log.error(
        {
          operation: 'CourseService.getAllCourses',
          success: false,
          duration,
          error: error instanceof Error ? error.message : 'Unknown error',
          errorType: error?.constructor?.name,
          params: { page, limit },
        },
        'Failed to retrieve courses from database',
      );

      throw error;
    }
  }

  // Enhanced version with request context for better correlation
  async getAllCoursesWithContext(
    page: number = 1,
    limit: number = 10,
    context: { requestId: string; userId?: string },
  ) {
    const startTime = Date.now();

    this.fastify.log.info(
      {
        operation: 'CourseService.getAllCoursesWithContext',
        params: { page, limit },
        requestId: context.requestId,
        userId: context.userId,
      },
      `[${context.requestId}] Getting all courses with pagination: page=${page}, limit=${limit}`,
    );

    try {
      // Calculate skip value for pagination
      const skip = (page - 1) * limit;

      // Get total count for pagination
      const total = await this.courseModel.countDocuments();

      this.fastify.log.debug(
        {
          operation: 'CourseService.getAllCoursesWithContext',
          totalCount: total,
          skip,
          limit,
          requestId: context.requestId,
          userId: context.userId,
        },
        `[${context.requestId}] Found ${total} total courses, fetching with skip=${skip}`,
      );

      // Get courses with pagination
      const courses = await this.courseModel
        .find()
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean();

      const duration = Date.now() - startTime;

      this.fastify.log.info(
        {
          operation: 'CourseService.getAllCoursesWithContext',
          success: true,
          duration,
          resultCount: courses.length,
          totalCourses: total,
          page,
          limit,
          requestId: context.requestId,
          userId: context.userId,
        },
        `[${context.requestId}] Successfully retrieved ${courses.length} courses in ${duration}ms`,
      );

      return {
        courses: courses.map((course) => ({
          ...course,
          _id: course._id.toString(),
          modules: course.modules.map((module) => ({
            ...module,
            _id: module._id.toString(),
            lessons: module.lessons.map((lesson) => ({
              ...lesson,
              _id: lesson._id.toString(),
            })),
          })),
        })) as Course[],
        total,
      };
    } catch (error) {
      const duration = Date.now() - startTime;

      this.fastify.log.error(
        {
          operation: 'CourseService.getAllCoursesWithContext',
          success: false,
          duration,
          error: error instanceof Error ? error.message : 'Unknown error',
          errorType: error?.constructor?.name,
          params: { page, limit },
          requestId: context.requestId,
          userId: context.userId,
        },
        `[${context.requestId}] Failed to retrieve courses from database`,
      );

      throw error;
    }
  }

  async getCourseById(courseId: string): Promise<Course | null> {
    const startTime = Date.now();

    this.fastify.log.info(
      {
        operation: 'CourseService.getCourseById',
        courseId,
      },
      `Getting course by ID: ${courseId}`,
    );

    try {
      const course = await this.courseModel.findById(courseId).lean();
      const duration = Date.now() - startTime;

      if (!course) {
        this.fastify.log.warn(
          {
            operation: 'CourseService.getCourseById',
            courseId,
            found: false,
            duration,
          },
          `Course not found in database: ${courseId}`,
        );
        return null;
      }

      this.fastify.log.info(
        {
          operation: 'CourseService.getCourseById',
          courseId,
          found: true,
          duration,
          courseTitle: course.title,
        },
        `Successfully retrieved course: ${course.title} in ${duration}ms`,
      );

      // Transform the MongoDB document to match the Course type
      return {
        ...course,
        _id: course._id.toString(),
        modules: course.modules.map((module) => ({
          ...module,
          _id: module._id.toString(),
          lessons: module.lessons.map((lesson) => ({
            ...lesson,
            _id: lesson._id.toString(),
          })),
        })),
      } as Course;
    } catch (error) {
      const duration = Date.now() - startTime;

      this.fastify.log.error(
        {
          operation: 'CourseService.getCourseById',
          courseId,
          success: false,
          duration,
          error: error instanceof Error ? error.message : 'Unknown error',
          errorType: error?.constructor?.name,
        },
        `Failed to retrieve course from database: ${courseId}`,
      );

      throw error;
    }
  }

  async createCourse(courseData: CreateCoursePayload): Promise<Course> {
    const logContext = this.logger.startOperation('CourseService.createCourse', {
      courseTitle: courseData.title,
      category: courseData.category,
      difficulty: courseData.difficulty,
      instructor: courseData.instructor,
    });

    try {
      // Use the validation helper with logger - demonstrates Option 2
      const validation = CourseValidationHelpers.validateCourseData(courseData, this.logger);

      if (!validation.isValid) {
        this.logger.warn(
          {
            operation: 'CourseService.createCourse',
            validationErrors: validation.errors,
          },
          'Course creation validation failed',
        );
        throw new Error(`Validation failed: ${validation.errors.join(', ')}`);
      }

      // Sanitize data using utility with logger
      const sanitizedData = CourseValidationHelpers.sanitizeCourseData(courseData, this.logger);

      const course = await this.courseModel.create({
        ...sanitizedData,
        modules: [],
        totalLessons: 0,
        studentCount: 0,
        // Set default values for any missing fields
        featured: sanitizedData.featured || false,
        bestseller: sanitizedData.bestseller || false,
        newCourse: sanitizedData.newCourse || false,
        language: sanitizedData.language || 'English',
      });

      // Transform the MongoDB document to match the Course type
      const courseObj = course.toObject();
      const transformedCourse = {
        ...courseObj,
        _id: courseObj._id.toString(),
        modules: courseObj.modules.map((module) => ({
          ...module,
          _id: module._id.toString(),
          lessons: module.lessons.map((lesson) => ({
            ...lesson,
            _id: lesson._id.toString(),
          })),
        })),
      } as Course;

      // Use Logger utility for success logging
      this.logger.endOperation(
        logContext,
        `Successfully created course: ${transformedCourse.title} (ID: ${transformedCourse._id})`,
        {
          courseId: transformedCourse._id,
          courseTitle: transformedCourse.title,
          category: transformedCourse.category,
        },
      );

      // Log business metrics using Logger utility
      this.logger.logMetric(
        'course_created_service',
        {
          courseId: transformedCourse._id,
          category: transformedCourse.category,
          difficulty: transformedCourse.difficulty,
          instructor: transformedCourse.instructor,
        },
        'Course creation service metric',
      );

      return transformedCourse;
    } catch (error) {
      // Use Logger utility for error logging
      this.logger.errorOperation(logContext, error, 'Failed to create course in database', {
        courseData: {
          title: courseData.title,
          category: courseData.category,
          // Don't log sensitive data
        },
      });

      throw error;
    }
  }

  async updateCourse(courseId: string, courseData: UpdateCoursePayload): Promise<Course | null> {
    const logContext = this.logger.startOperation('CourseService.updateCourse', {
      courseId,
      updateFields: Object.keys(courseData),
    });

    try {
      const course = await this.courseModel
        .findByIdAndUpdate(courseId, { $set: courseData }, { new: true, runValidators: true })
        .lean();

      if (!course) {
        this.logger.warn(
          {
            operation: 'CourseService.updateCourse',
            courseId,
            found: false,
          },
          `Course not found for update: ${courseId}`,
        );
        return null;
      }

      // Transform the MongoDB document to match the Course type
      const transformedCourse = {
        ...course,
        _id: course._id.toString(),
        modules: course.modules.map((module) => ({
          ...module,
          _id: module._id.toString(),
          lessons: module.lessons.map((lesson) => ({
            ...lesson,
            _id: lesson._id.toString(),
          })),
        })),
      } as Course;

      // Use Logger utility for success logging
      this.logger.endOperation(
        logContext,
        `Successfully updated course: ${transformedCourse.title}`,
        {
          courseId,
          courseTitle: transformedCourse.title,
          updatedFields: Object.keys(courseData),
        },
      );

      return transformedCourse;
    } catch (error) {
      // Use Logger utility for error logging
      this.logger.errorOperation(logContext, error, `Failed to update course: ${courseId}`, {
        updateFields: Object.keys(courseData),
      });

      throw error;
    }
  }

  async deleteCourse(courseId: string): Promise<boolean> {
    const logContext = this.logger.startOperation('CourseService.deleteCourse', { courseId });

    try {
      const result = await this.courseModel.findByIdAndDelete(courseId);
      const success = !!result;

      if (success) {
        this.logger.endOperation(logContext, `Successfully deleted course: ${courseId}`, {
          courseId,
        });
        // Log business metric
        this.logger.logMetric('course_deleted', { courseId }, 'Course deletion metric');
      } else {
        this.logger.warn(
          {
            operation: 'CourseService.deleteCourse',
            courseId,
            found: false,
          },
          `Course not found for deletion: ${courseId}`,
        );
      }

      return success;
    } catch (error) {
      this.logger.errorOperation(logContext, error, `Failed to delete course: ${courseId}`, {
        courseId,
      });
      throw error;
    }
  }

  // Curriculum methods
  async getCurriculum(courseId: string) {
    const startTime = Date.now();

    this.fastify.log.info(
      {
        operation: 'CourseService.getCurriculum',
        courseId,
      },
      `Getting curriculum for course: ${courseId}`,
    );

    try {
      const course = await this.courseModel.findById(courseId).lean();
      const duration = Date.now() - startTime;

      if (!course) {
        this.fastify.log.warn(
          {
            operation: 'CourseService.getCurriculum',
            courseId,
            found: false,
            duration,
          },
          `Course not found for curriculum: ${courseId}`,
        );
        return null;
      }

      // Handle the case where modules may be empty or undefined
      const modules = course.modules || [];

      // Sort modules by order if they exist
      const sortedModules = [...modules]
        .map((module: any) => {
          // Make sure we're transforming _id to a string format needed by the frontend
          const moduleWithFormattedId = {
            ...module,
            _id: module._id.toString(),
            lessons: Array.isArray(module.lessons)
              ? module.lessons
                  .map((lesson: any) => ({
                    ...lesson,
                    _id: lesson._id.toString(),
                    moduleId: module._id.toString(),
                    isCompleted: false, // Default value
                  }))
                  .sort((a: any, b: any) => a.order - b.order)
              : [],
          };

          return moduleWithFormattedId;
        })
        .sort((a: any, b: any) => a.order - b.order);

      const moduleCount = sortedModules.length;
      const lessonCount = sortedModules.reduce(
        (total, module) => total + (module.lessons?.length || 0),
        0,
      );

      this.fastify.log.info(
        {
          operation: 'CourseService.getCurriculum',
          success: true,
          courseId,
          moduleCount,
          lessonCount,
          duration,
        },
        `Successfully retrieved curriculum for course: ${courseId} (${moduleCount} modules, ${lessonCount} lessons) in ${duration}ms`,
      );

      return { courseId, modules: sortedModules };
    } catch (error) {
      const duration = Date.now() - startTime;

      this.fastify.log.error(
        {
          operation: 'CourseService.getCurriculum',
          courseId,
          success: false,
          duration,
          error: error instanceof Error ? error.message : 'Unknown error',
          errorType: error?.constructor?.name,
        },
        `Failed to retrieve curriculum for course: ${courseId}`,
      );

      throw error;
    }
  }

  // Module methods
  async getModule(courseId: string, moduleId: string) {
    // Simple logging without performance tracking for quick operations
    this.logger.info(
      {
        operation: 'CourseService.getModule',
        courseId,
        moduleId,
      },
      `Getting module: ${moduleId} from course: ${courseId}`,
    );

    try {
      const module = await CourseHelpers.getModule(courseId, moduleId);

      if (!module) {
        this.logger.warn(
          {
            operation: 'CourseService.getModule',
            courseId,
            moduleId,
            found: false,
          },
          `Module not found: ${moduleId} in course: ${courseId}`,
        );
        return null;
      }

      this.logger.info(
        {
          operation: 'CourseService.getModule',
          courseId,
          moduleId,
          moduleTitle: module.title,
          found: true,
        },
        `Successfully retrieved module: ${module.title}`,
      );

      return module;
    } catch (error) {
      this.logger.error(
        {
          operation: 'CourseService.getModule',
          courseId,
          moduleId,
          error: error instanceof Error ? error.message : 'Unknown error',
          errorType: error?.constructor?.name,
        },
        `Failed to retrieve module: ${moduleId} from course: ${courseId}`,
      );
      throw error;
    }
  }

  async createModule(courseId: string, moduleData: CreateModulePayload) {
    // Using Logger utility with performance tracking
    const logContext = this.logger.startOperation('CourseService.createModule', {
      courseId,
      moduleTitle: moduleData.title,
      moduleOrder: moduleData.order,
    });

    try {
      const newModule = await CourseHelpers.addModule(courseId, moduleData);

      if (!newModule) {
        this.logger.error(
          {
            operation: 'CourseService.createModule',
            courseId,
            moduleData: { title: moduleData.title, order: moduleData.order },
          },
          'Failed to create module - CourseHelpers.addModule returned null',
        );
        throw new NotFoundError('Failed to create module');
      }

      // Success logging with Logger utility
      this.logger.endOperation(
        logContext,
        `Successfully created module: ${newModule.title} (ID: ${newModule._id})`,
        {
          moduleId: newModule._id,
          moduleTitle: newModule.title,
          moduleOrder: newModule.order,
        },
      );

      return newModule;
    } catch (error) {
      // Error logging with Logger utility
      this.logger.errorOperation(
        logContext,
        error,
        `Failed to create module in course: ${courseId}`,
        {
          moduleData: { title: moduleData.title, order: moduleData.order },
        },
      );
      throw error;
    }
  }

  async updateModule(courseId: string, moduleId: string, moduleData: UpdateModulePayload) {
    const updatedModule = await CourseHelpers.updateModule(courseId, moduleId, moduleData);
    if (!updatedModule) return null;
    return updatedModule;
  }

  async deleteModule(courseId: string, moduleId: string): Promise<boolean> {
    return CourseHelpers.deleteModule(courseId, moduleId);
  }

  // Lesson methods
  async getLesson(courseId: string, moduleId: string, lessonId: string) {
    const startTime = Date.now();

    this.fastify.log.info(
      {
        operation: 'CourseService.getLesson',
        courseId,
        moduleId,
        lessonId,
      },
      `Fetching lesson: ${lessonId} from module: ${moduleId} in course: ${courseId}`,
    );

    try {
      const lesson = await CourseHelpers.getLesson(courseId, moduleId, lessonId);
      const duration = Date.now() - startTime;

      if (!lesson) {
        this.fastify.log.warn(
          {
            operation: 'CourseService.getLesson',
            courseId,
            moduleId,
            lessonId,
            found: false,
            duration,
          },
          `Lesson not found: ${lessonId} in module: ${moduleId} of course: ${courseId}`,
        );
        return null;
      }

      this.fastify.log.info(
        {
          operation: 'CourseService.getLesson',
          success: true,
          courseId,
          moduleId,
          lessonId,
          lessonTitle: lesson.title,
          duration,
        },
        `Successfully retrieved lesson: ${lesson.title} in ${duration}ms`,
      );

      return lesson;
    } catch (error) {
      const duration = Date.now() - startTime;

      this.fastify.log.error(
        {
          operation: 'CourseService.getLesson',
          courseId,
          moduleId,
          lessonId,
          success: false,
          duration,
          error: error instanceof Error ? error.message : 'Unknown error',
          errorType: error?.constructor?.name,
        },
        `Failed to retrieve lesson: ${lessonId} from module: ${moduleId} in course: ${courseId}`,
      );

      throw error;
    }
  }

  async createLesson(courseId: string, moduleId: string, lessonData: CreateLessonPayload) {
    const newLesson = await CourseHelpers.addLesson(courseId, moduleId, lessonData);
    if (!newLesson) throw new NotFoundError('Failed to create lesson');
    return newLesson;
  }

  async updateLesson(
    courseId: string,
    moduleId: string,
    lessonId: string,
    lessonData: UpdateLessonPayload,
  ) {
    const updatedLesson = await CourseHelpers.updateLesson(
      courseId,
      moduleId,
      lessonId,
      lessonData,
    );
    if (!updatedLesson) return null;
    return updatedLesson;
  }

  async deleteLesson(courseId: string, moduleId: string, lessonId: string): Promise<boolean> {
    return CourseHelpers.deleteLesson(courseId, moduleId, lessonId);
  }
}
