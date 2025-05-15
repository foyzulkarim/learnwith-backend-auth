import { FastifyReply, FastifyRequest } from 'fastify';
import { CourseService } from './course.service';
import { Course, Module, Lesson } from './types';

interface CourseQueryParams {
  search?: string;
  categoryId?: string;
  limit?: string;
}

export class CourseController {
  constructor(private courseService: CourseService) {}

  async getAllCoursesHandler(
    request: FastifyRequest<{
      Querystring: CourseQueryParams;
    }>,
    reply: FastifyReply,
  ) {
    const { search, categoryId, limit } = request.query;

    // Parse query parameters
    const filters = {
      search: search,
      categoryId: categoryId ? parseInt(categoryId, 10) : undefined,
      limit: limit ? parseInt(limit, 10) : undefined,
    };

    const courses = await this.courseService.getAllCourses(filters);
    reply.send(courses);
  }

  async getCourseByIdHandler(
    request: FastifyRequest<{
      Params: { courseId: string };
    }>,
    reply: FastifyReply,
  ) {
    const courseId = parseInt(request.params.courseId, 10);

    if (isNaN(courseId)) {
      return reply.code(400).send({ error: 'Invalid course ID' });
    }

    const course = await this.courseService.getCourseById(courseId);

    if (!course) {
      return reply.code(404).send({ error: 'Course not found' });
    }

    reply.send(course);
  }

  async getCourseLessonsHandler(
    request: FastifyRequest<{
      Params: { courseId: string };
    }>,
    reply: FastifyReply,
  ) {
    const courseId = parseInt(request.params.courseId, 10);

    if (isNaN(courseId)) {
      return reply.code(400).send({ error: 'Invalid course ID' });
    }

    // Check if course exists
    const course = await this.courseService.getCourseById(courseId);

    if (!course) {
      return reply.code(404).send({ error: 'Course not found' });
    }

    const lessons = await this.courseService.getCourseLessons(courseId);
    reply.send(lessons);
  }

  async getCategoriesHandler(_request: FastifyRequest, reply: FastifyReply) {
    const categories = await this.courseService.getCategories();
    reply.send(categories);
  }

  // New handlers for course CRUD operations
  async createCourseHandler(
    request: FastifyRequest<{
      Body: Omit<Course, 'id'>;
    }>,
    reply: FastifyReply,
  ) {
    try {
      const courseData = request.body;
      const course = await this.courseService.createCourse(courseData);
      reply.code(201).send(course);
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      reply.code(400).send({ error: 'Failed to create course', details: errorMessage });
    }
  }

  async saveCourseHandler(
    request: FastifyRequest<{
      Body: {
        title: string;
        description: string;
        categoryId: number;
        difficulty: string;
        price: string;
        isFeatured: boolean;
        isBestseller: boolean;
        isNew: boolean;
        thumbnail: string;
        instructor: string;
        featured: boolean;
        bestseller: boolean;
      };
    }>,
    reply: FastifyReply,
  ) {
    try {
      const {
        title,
        description,
        categoryId,
        difficulty,
        price,
        isFeatured,
        isBestseller,
        isNew,
        thumbnail,
        instructor,
      } = request.body;

      // Prepare course data
      const courseData = {
        title,
        description,
        categoryId,
        difficulty: difficulty || 'beginner',
        price,
        featured: isFeatured,
        bestseller: isBestseller,
        isNew,
        thumbnail,
        instructor: instructor || 'Default Instructor',
        totalLessons: 0,
      };

      // Use the existing createCourse service method
      const course = await this.courseService.createCourse(courseData);
      reply.code(201).send(course);
    } catch (error: unknown) {
      console.error('Error saving course:', error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      reply.code(400).send({ error: 'Failed to save course', details: errorMessage });
    }
  }

  async updateCourseHandler(
    request: FastifyRequest<{
      Params: { courseId: string };
      Body: Partial<Course>;
    }>,
    reply: FastifyReply,
  ) {
    try {
      const courseId = parseInt(request.params.courseId, 10);

      if (isNaN(courseId)) {
        return reply.code(400).send({ error: 'Invalid course ID' });
      }

      const courseData = request.body;
      const updatedCourse = await this.courseService.updateCourse(courseId, courseData);

      if (!updatedCourse) {
        return reply.code(404).send({ error: 'Course not found' });
      }

      reply.send(updatedCourse);
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      reply.code(400).send({ error: 'Failed to update course', details: errorMessage });
    }
  }

  async deleteCourseHandler(
    request: FastifyRequest<{
      Params: { courseId: string };
    }>,
    reply: FastifyReply,
  ) {
    try {
      const courseId = parseInt(request.params.courseId, 10);

      if (isNaN(courseId)) {
        return reply.code(400).send({ error: 'Invalid course ID' });
      }

      const deleted = await this.courseService.deleteCourse(courseId);

      if (!deleted) {
        return reply.code(404).send({ error: 'Course not found' });
      }

      reply.code(204).send();
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      reply.code(400).send({ error: 'Failed to delete course', details: errorMessage });
    }
  }

  // Module handlers
  async getCourseModulesHandler(
    request: FastifyRequest<{
      Params: { courseId: string };
    }>,
    reply: FastifyReply,
  ) {
    try {
      const courseId = parseInt(request.params.courseId, 10);

      if (isNaN(courseId)) {
        return reply.code(400).send({ error: 'Invalid course ID' });
      }

      // Check if course exists
      const course = await this.courseService.getCourseById(courseId);

      if (!course) {
        return reply.code(404).send({ error: 'Course not found' });
      }

      const modules = await this.courseService.getCourseModules(courseId);
      reply.send(modules);
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      reply.code(400).send({ error: 'Failed to get course modules', details: errorMessage });
    }
  }

  async createModuleHandler(
    request: FastifyRequest<{
      Body: Omit<Module, 'id'>;
    }>,
    reply: FastifyReply,
  ) {
    try {
      const moduleData = request.body;
      const createdModule = await this.courseService.createModule(moduleData);
      reply.code(201).send(createdModule);
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      reply.code(400).send({ error: 'Failed to create module', details: errorMessage });
    }
  }

  async updateModuleHandler(
    request: FastifyRequest<{
      Params: { moduleId: string };
      Body: Partial<Module>;
    }>,
    reply: FastifyReply,
  ) {
    try {
      const moduleId = parseInt(request.params.moduleId, 10);

      if (isNaN(moduleId)) {
        return reply.code(400).send({ error: 'Invalid module ID' });
      }

      const moduleData = request.body;
      const updatedModule = await this.courseService.updateModule(moduleId, moduleData);

      if (!updatedModule) {
        return reply.code(404).send({ error: 'Module not found' });
      }

      reply.send(updatedModule);
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      reply.code(400).send({ error: 'Failed to update module', details: errorMessage });
    }
  }

  async deleteModuleHandler(
    request: FastifyRequest<{
      Params: { moduleId: string };
    }>,
    reply: FastifyReply,
  ) {
    try {
      const moduleId = parseInt(request.params.moduleId, 10);

      if (isNaN(moduleId)) {
        return reply.code(400).send({ error: 'Invalid module ID' });
      }

      const deleted = await this.courseService.deleteModule(moduleId);

      if (!deleted) {
        return reply.code(404).send({ error: 'Module not found' });
      }

      reply.code(204).send();
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      reply.code(400).send({ error: 'Failed to delete module', details: errorMessage });
    }
  }

  // Lesson handlers
  async createLessonHandler(
    request: FastifyRequest<{
      Body: Omit<Lesson, 'id'>;
    }>,
    reply: FastifyReply,
  ) {
    try {
      const lessonData = request.body;
      const createdLesson = await this.courseService.createLesson(lessonData);
      reply.code(201).send(createdLesson);
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      reply.code(400).send({ error: 'Failed to create lesson', details: errorMessage });
    }
  }

  async updateLessonHandler(
    request: FastifyRequest<{
      Params: { lessonId: string };
      Body: Partial<Lesson>;
    }>,
    reply: FastifyReply,
  ) {
    try {
      const lessonId = parseInt(request.params.lessonId, 10);

      if (isNaN(lessonId)) {
        return reply.code(400).send({ error: 'Invalid lesson ID' });
      }

      const lessonData = request.body;
      const updatedLesson = await this.courseService.updateLesson(lessonId, lessonData);

      if (!updatedLesson) {
        return reply.code(404).send({ error: 'Lesson not found' });
      }

      reply.send(updatedLesson);
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      reply.code(400).send({ error: 'Failed to update lesson', details: errorMessage });
    }
  }

  async deleteLessonHandler(
    request: FastifyRequest<{
      Params: { lessonId: string };
    }>,
    reply: FastifyReply,
  ) {
    try {
      const lessonId = parseInt(request.params.lessonId, 10);

      if (isNaN(lessonId)) {
        return reply.code(400).send({ error: 'Invalid lesson ID' });
      }

      const deleted = await this.courseService.deleteLesson(lessonId);

      if (!deleted) {
        return reply.code(404).send({ error: 'Lesson not found' });
      }

      reply.code(204).send();
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      reply.code(400).send({ error: 'Failed to delete lesson', details: errorMessage });
    }
  }
}
