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
    async (
      request: FastifyRequest<{ Querystring: { page?: number; limit?: number } }>,
      _reply: FastifyReply,
    ): Promise<PaginatedCourseResponse> => {
      const page = request.query.page || 1;
      const limit = request.query.limit || 10;

      const result = await this.courseService.getAllCourses(page, limit);

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
    async (
      request: FastifyRequest<{ Params: { courseId: string } }>,
      _reply: FastifyReply,
    ): Promise<Course> => {
      const course = await this.courseService.getCourseById(request.params.courseId);

      if (!course) {
        throw new NotFoundError('Course not found');
      }

      return course;
    },
  );

  // Create course
  createCourseHandler = asyncHandler(
    async (
      request: FastifyRequest<{ Body: CreateCoursePayload }>,
      _reply: FastifyReply,
    ): Promise<Course> => {
      const courseData = request.body;

      // Validate required fields
      if (!courseData.title) throw new ValidationError('Title is required');
      if (!courseData.description) throw new ValidationError('Description is required');
      if (!courseData.thumbnailUrl) throw new ValidationError('Thumbnail is required');
      if (!courseData.instructor) throw new ValidationError('Instructor is required');
      if (!courseData.category) throw new ValidationError('Category is required');
      if (!courseData.difficulty) throw new ValidationError('Difficulty is required');

      const newCourse = await this.courseService.createCourse(courseData);

      reply.code(201);
      return newCourse;
    },
  );

  // Update course
  updateCourseHandler = asyncHandler(
    async (
      request: FastifyRequest<{ Params: { courseId: string }; Body: UpdateCoursePayload }>,
      _reply: FastifyReply,
    ): Promise<Course> => {
      const { courseId } = request.params;
      const courseData = request.body;

      const updatedCourse = await this.courseService.updateCourse(courseId, courseData);

      if (!updatedCourse) {
        throw new NotFoundError('Course not found');
      }

      return updatedCourse;
    },
  );

  // Delete course
  deleteCourseHandler = asyncHandler(
    async (
      request: FastifyRequest<{ Params: { courseId: string } }>,
      _reply: FastifyReply,
    ): Promise<SuccessResponse> => {
      const { courseId } = request.params;

      const result = await this.courseService.deleteCourse(courseId);

      if (!result) {
        throw new NotFoundError('Course not found');
      }

      return { success: true };
    },
  );

  // Curriculum Handlers

  // Get course curriculum
  getCurriculumHandler = asyncHandler(
    async (request: FastifyRequest<{ Params: { courseId: string } }>, _reply: FastifyReply) => {
      const { courseId } = request.params;

      const curriculum = await this.courseService.getCurriculum(courseId);

      if (!curriculum) {
        throw new NotFoundError('Course not found');
      }

      return curriculum;
    },
  );

  // Module Handlers

  // Get module
  getModuleHandler = asyncHandler(
    async (
      request: FastifyRequest<{ Params: { courseId: string; moduleId: string } }>,
      _reply: FastifyReply,
    ) => {
      const { courseId, moduleId } = request.params;

      const module = await this.courseService.getModule(courseId, moduleId);

      if (!module) {
        throw new NotFoundError('Module not found');
      }

      return module;
    },
  );

  // Create module
  createModuleHandler = asyncHandler(
    async (
      request: FastifyRequest<{ Params: { courseId: string }; Body: CreateModulePayload }>,
      _reply: FastifyReply,
    ) => {
      const { courseId } = request.params;
      const moduleData = request.body;

      // Validate required fields
      if (!moduleData.title) throw new ValidationError('Title is required');
      if (moduleData.order === undefined) throw new ValidationError('Order is required');

      const newModule = await this.courseService.createModule(courseId, moduleData);

      reply.code(201);
      return newModule;
    },
  );

  // Update module
  updateModuleHandler = asyncHandler(
    async (
      request: FastifyRequest<{
        Params: { courseId: string; moduleId: string };
        Body: UpdateModulePayload;
      }>,
      _reply: FastifyReply,
    ) => {
      const { courseId, moduleId } = request.params;
      const moduleData = request.body;

      const updatedModule = await this.courseService.updateModule(courseId, moduleId, moduleData);

      if (!updatedModule) {
        throw new NotFoundError('Module not found');
      }

      return updatedModule;
    },
  );

  // Delete module
  deleteModuleHandler = asyncHandler(
    async (
      request: FastifyRequest<{ Params: { courseId: string; moduleId: string } }>,
      _reply: FastifyReply,
    ): Promise<SuccessResponse> => {
      const { courseId, moduleId } = request.params;

      const result = await this.courseService.deleteModule(courseId, moduleId);

      if (!result) {
        throw new NotFoundError('Module not found');
      }

      return { success: true };
    },
  );

  // Lesson Handlers

  // Get lesson
  getLessonHandler = asyncHandler(
    async (
      request: FastifyRequest<{ Params: { courseId: string; moduleId: string; lessonId: string } }>,
    ) => {
      const { courseId, moduleId, lessonId } = request.params;

      const lesson = await this.courseService.getLesson(courseId, moduleId, lessonId);

      if (!lesson) {
        throw new NotFoundError('Lesson not found');
      }

      return lesson;
    },
  );

  // Create lesson
  createLessonHandler = asyncHandler(
    async (
      request: FastifyRequest<{
        Params: { courseId: string; moduleId: string };
        Body: CreateLessonPayload;
      }>,
      _reply: FastifyReply,
    ) => {
      const { courseId, moduleId } = request.params;
      const lessonData = request.body;

      // Validate required fields
      if (!lessonData.title) throw new ValidationError('Title is required');
      if (lessonData.order === undefined) throw new ValidationError('Order is required');

      const newLesson = await this.courseService.createLesson(courseId, moduleId, lessonData);

      reply.code(201);
      return newLesson;
    },
  );

  // Update lesson
  updateLessonHandler = asyncHandler(
    async (
      request: FastifyRequest<{
        Params: { courseId: string; moduleId: string; lessonId: string };
        Body: UpdateLessonPayload;
      }>,
      _reply: FastifyReply,
    ) => {
      const { courseId, moduleId, lessonId } = request.params;
      const lessonData = request.body;

      const updatedLesson = await this.courseService.updateLesson(
        courseId,
        moduleId,
        lessonId,
        lessonData,
      );

      if (!updatedLesson) {
        throw new NotFoundError('Lesson not found');
      }

      return updatedLesson;
    },
  );

  // Delete lesson
  deleteLessonHandler = asyncHandler(
    async (
      request: FastifyRequest<{ Params: { courseId: string; moduleId: string; lessonId: string } }>,
      _reply: FastifyReply,
    ): Promise<SuccessResponse> => {
      const { courseId, moduleId, lessonId } = request.params;

      const result = await this.courseService.deleteLesson(courseId, moduleId, lessonId);

      if (!result) {
        throw new NotFoundError('Lesson not found');
      }

      return { success: true };
    },
  );
}
