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
      request.log.info('[CourseController] getAllCoursesHandler started.');
      const page = (request.query as { page: number }).page || 1;
      const limit = (request.query as { limit: number }).limit || 10;
      request.log.debug({ page, limit }, '[CourseController] Pagination parameters.');

      const result = await this.courseService.getAllCourses(page, limit);
      request.log.info(`[CourseController] Fetched ${result.courses.length} courses, total ${result.total}.`);

      return {
        courses: result.courses,
        total: result.total,
        page,
        limit,
      };
    },
  );

  // Get course by ID
  getCourseByIdHandler = asyncHandler(
    async (request: FastifyRequest, _reply: FastifyReply): Promise<Course> => {
      const { courseId } = request.params as { courseId: string };
      request.log.info(`[CourseController] getCourseByIdHandler started for courseId: ${courseId}`);

      const course = await this.courseService.getCourseById(courseId);

      if (!course) {
        request.log.warn(`[CourseController] Course not found for courseId: ${courseId}`);
        throw new NotFoundError('Course not found');
      }

      request.log.info(`[CourseController] Successfully fetched course for courseId: ${courseId}`);
      return course;
    },
  );

  // Create course
  createCourseHandler = asyncHandler(
    async (request: FastifyRequest, reply: FastifyReply): Promise<Course> => {
      request.log.info('[CourseController] createCourseHandler started.');
      const courseData = request.body as CreateCoursePayload;
      request.log.debug({ courseData }, '[CourseController] Course creation payload.');

      // Validate required fields
      if (!courseData.title) {
        request.log.warn('[CourseController] Validation failed for createCourse: Title is required.');
        throw new ValidationError('Title is required');
      }
      if (!courseData.description) {
        request.log.warn('[CourseController] Validation failed for createCourse: Description is required.');
        throw new ValidationError('Description is required');
      }
      if (!courseData.thumbnailUrl) {
        request.log.warn('[CourseController] Validation failed for createCourse: Thumbnail is required.');
        throw new ValidationError('Thumbnail is required');
      }
      if (!courseData.instructor) {
        request.log.warn('[CourseController] Validation failed for createCourse: Instructor is required.');
        throw new ValidationError('Instructor is required');
      }
      if (!courseData.category) {
        request.log.warn('[CourseController] Validation failed for createCourse: Category is required.');
        throw new ValidationError('Category is required');
      }
      if (!courseData.difficulty) {
        request.log.warn('[CourseController] Validation failed for createCourse: Difficulty is required.');
        throw new ValidationError('Difficulty is required');
      }

      const newCourse = await this.courseService.createCourse(courseData);
      request.log.info({ courseId: newCourse._id }, '[CourseController] Successfully created new course.');

      reply.code(201);
      return newCourse;
    },
  );

  // Update course
  updateCourseHandler = asyncHandler(
    async (request: FastifyRequest, _reply: FastifyReply): Promise<Course> => {
      const { courseId } = request.params as { courseId: string };
      request.log.info(`[CourseController] updateCourseHandler started for courseId: ${courseId}`);
      const courseData = request.body as UpdateCoursePayload;
      request.log.debug({ courseId, courseData }, '[CourseController] Course update payload.');

      const updatedCourse = await this.courseService.updateCourse(courseId, courseData);

      if (!updatedCourse) {
        request.log.warn(`[CourseController] Course not found for update, courseId: ${courseId}`);
        throw new NotFoundError('Course not found');
      }

      request.log.info(`[CourseController] Successfully updated course for courseId: ${courseId}`);
      return updatedCourse;
    },
  );

  // Delete course
  deleteCourseHandler = asyncHandler(
    async (request: FastifyRequest, _reply: FastifyReply): Promise<SuccessResponse> => {
      const { courseId } = request.params as { courseId: string };
      request.log.info(`[CourseController] deleteCourseHandler started for courseId: ${courseId}`);

      const result = await this.courseService.deleteCourse(courseId);

      if (!result) {
        request.log.warn(`[CourseController] Course not found for deletion, courseId: ${courseId}`);
        throw new NotFoundError('Course not found');
      }

      request.log.info(`[CourseController] Successfully deleted course for courseId: ${courseId}`);
      return { success: true };
    },
  );

  // Curriculum Handlers

  // Get course curriculum
  getCurriculumHandler = asyncHandler(async (request: FastifyRequest, _reply: FastifyReply) => {
    const { courseId } = request.params as { courseId: string };
    request.log.info(`[CourseController] getCurriculumHandler started for courseId: ${courseId}`);

    const curriculum = await this.courseService.getCurriculum(courseId);

    if (!curriculum) {
      request.log.warn(`[CourseController] Curriculum (or course) not found for courseId: ${courseId}`);
      throw new NotFoundError('Course not found');
    }

    request.log.info(`[CourseController] Successfully fetched curriculum for courseId: ${courseId}`);
    return curriculum;
  });

  // Module Handlers

  // Get module
  getModuleHandler = asyncHandler(async (request: FastifyRequest, _reply: FastifyReply) => {
    const { courseId, moduleId } = request.params as { courseId: string; moduleId: string };
    request.log.info(`[CourseController] getModuleHandler started for courseId: ${courseId}, moduleId: ${moduleId}`);

    const module = await this.courseService.getModule(courseId, moduleId);

    if (!module) {
      request.log.warn(`[CourseController] Module not found for courseId: ${courseId}, moduleId: ${moduleId}`);
      throw new NotFoundError('Module not found');
    }

    request.log.info(`[CourseController] Successfully fetched module for courseId: ${courseId}, moduleId: ${moduleId}`);
    return module;
  });

  // Create module
  createModuleHandler = asyncHandler(async (request: FastifyRequest, reply: FastifyReply) => {
    const { courseId } = request.params as { courseId: string };
    request.log.info(`[CourseController] createModuleHandler started for courseId: ${courseId}`);
    const moduleData = request.body as CreateModulePayload;
    request.log.debug({ courseId, moduleData }, '[CourseController] Module creation payload.');

    // Validate required fields
    if (!moduleData.title) {
      request.log.warn(`[CourseController] Validation failed for createModule in courseId ${courseId}: Title is required.`);
      throw new ValidationError('Title is required');
    }
    if (moduleData.order === undefined) {
      request.log.warn(`[CourseController] Validation failed for createModule in courseId ${courseId}: Order is required.`);
      throw new ValidationError('Order is required');
    }

    const newModule = await this.courseService.createModule(courseId, moduleData);
    request.log.info({ courseId, moduleId: newModule._id }, '[CourseController] Successfully created new module.');

    reply.code(201);
    return newModule;
  });

  // Update module
  updateModuleHandler = asyncHandler(async (request: FastifyRequest, _reply: FastifyReply) => {
    const { courseId, moduleId } = request.params as { courseId: string; moduleId: string };
    request.log.info(`[CourseController] updateModuleHandler started for courseId: ${courseId}, moduleId: ${moduleId}`);
    const moduleData = request.body as UpdateModulePayload;
    request.log.debug({ courseId, moduleId, moduleData }, '[CourseController] Module update payload.');

    const updatedModule = await this.courseService.updateModule(courseId, moduleId, moduleData);

    if (!updatedModule) {
      request.log.warn(`[CourseController] Module not found for update, courseId: ${courseId}, moduleId: ${moduleId}`);
      throw new NotFoundError('Module not found');
    }

    request.log.info(`[CourseController] Successfully updated module for courseId: ${courseId}, moduleId: ${moduleId}`);
    return updatedModule;
  });

  // Delete module
  deleteModuleHandler = asyncHandler(
    async (request: FastifyRequest, _reply: FastifyReply): Promise<SuccessResponse> => {
      const { courseId, moduleId } = request.params as { courseId: string; moduleId: string };
      request.log.info(`[CourseController] deleteModuleHandler started for courseId: ${courseId}, moduleId: ${moduleId}`);

      const result = await this.courseService.deleteModule(courseId, moduleId);

      if (!result) {
        request.log.warn(`[CourseController] Module not found for deletion, courseId: ${courseId}, moduleId: ${moduleId}`);
        throw new NotFoundError('Module not found');
      }

      request.log.info(`[CourseController] Successfully deleted module for courseId: ${courseId}, moduleId: ${moduleId}`);
      return { success: true };
    },
  );

  // Lesson Handlers

  // Get lesson
  getLessonHandler = asyncHandler(async (request: FastifyRequest) => {
    const { courseId, moduleId, lessonId } = request.params as {
      courseId: string;
      moduleId: string;
      lessonId: string;
    };
    request.log.info(`[CourseController] getLessonHandler started for courseId: ${courseId}, moduleId: ${moduleId}, lessonId: ${lessonId}`);

    const lesson = await this.courseService.getLesson(courseId, moduleId, lessonId);

    if (!lesson) {
      request.log.warn(`[CourseController] Lesson not found for courseId: ${courseId}, moduleId: ${moduleId}, lessonId: ${lessonId}`);
      throw new NotFoundError('Lesson not found');
    }

    request.log.info(`[CourseController] Successfully fetched lesson for courseId: ${courseId}, moduleId: ${moduleId}, lessonId: ${lessonId}`);
    return lesson;
  });

  // Create lesson
  createLessonHandler = asyncHandler(async (request: FastifyRequest, reply: FastifyReply) => {
    const { courseId, moduleId } = request.params as { courseId: string; moduleId: string };
    request.log.info(`[CourseController] createLessonHandler started for courseId: ${courseId}, moduleId: ${moduleId}`);
    const lessonData = request.body as CreateLessonPayload;
    request.log.debug({ courseId, moduleId, lessonData }, '[CourseController] Lesson creation payload.');

    // Validate required fields
    if (!lessonData.title) {
      request.log.warn(`[CourseController] Validation failed for createLesson in courseId ${courseId}, moduleId ${moduleId}: Title is required.`);
      throw new ValidationError('Title is required');
    }
    if (lessonData.order === undefined) {
      request.log.warn(`[CourseController] Validation failed for createLesson in courseId ${courseId}, moduleId ${moduleId}: Order is required.`);
      throw new ValidationError('Order is required');
    }

    const newLesson = await this.courseService.createLesson(courseId, moduleId, lessonData);
    request.log.info({ courseId, moduleId, lessonId: newLesson._id }, '[CourseController] Successfully created new lesson.');

    reply.code(201);
    return newLesson;
  });

  // Update lesson
  updateLessonHandler = asyncHandler(async (request: FastifyRequest, _reply: FastifyReply) => {
    const { courseId, moduleId, lessonId } = request.params as {
      courseId: string;
      moduleId: string;
      lessonId: string;
    };
    request.log.info(`[CourseController] updateLessonHandler started for courseId: ${courseId}, moduleId: ${moduleId}, lessonId: ${lessonId}`);
    const lessonData = request.body as UpdateLessonPayload;
    request.log.debug({ courseId, moduleId, lessonId, lessonData }, '[CourseController] Lesson update payload.');

    const updatedLesson = await this.courseService.updateLesson(
      courseId,
      moduleId,
      lessonId,
      lessonData,
    );

    if (!updatedLesson) {
      request.log.warn(`[CourseController] Lesson not found for update, courseId: ${courseId}, moduleId: ${moduleId}, lessonId: ${lessonId}`);
      throw new NotFoundError('Lesson not found');
    }

    request.log.info(`[CourseController] Successfully updated lesson for courseId: ${courseId}, moduleId: ${moduleId}, lessonId: ${lessonId}`);
    return updatedLesson;
  });

  // Delete lesson
  deleteLessonHandler = asyncHandler(
    async (request: FastifyRequest, _reply: FastifyReply): Promise<SuccessResponse> => {
      const { courseId, moduleId, lessonId } = request.params as {
        courseId: string;
        moduleId: string;
        lessonId: string;
      };
      request.log.info(`[CourseController] deleteLessonHandler started for courseId: ${courseId}, moduleId: ${moduleId}, lessonId: ${lessonId}`);

      const result = await this.courseService.deleteLesson(courseId, moduleId, lessonId);

      if (!result) {
        request.log.warn(`[CourseController] Lesson not found for deletion, courseId: ${courseId}, moduleId: ${moduleId}, lessonId: ${lessonId}`);
        throw new NotFoundError('Lesson not found');
      }

      request.log.info(`[CourseController] Successfully deleted lesson for courseId: ${courseId}, moduleId: ${moduleId}, lessonId: ${lessonId}`);
      return { success: true };
    },
  );
}
