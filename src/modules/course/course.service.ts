import { FastifyInstance, FastifyRequest } from 'fastify';
import { getCourseModel, CourseHelpers } from './course.model';
import {
  Course,
  CreateLessonPayload,
  CreateModulePayload,
  UpdateLessonPayload,
  UpdateModulePayload,
} from './types';
import { NotFoundError } from '../../utils/errors';
import { withLogglyTags } from '../../utils/logglyHelper';
import { createServiceLogger } from '../../utils/logger';

interface PaginatedResult<T> {
  data: T[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
    hasNextPage: boolean;
    hasPrevPage: boolean;
  };
}

interface CreateCourseData {
  title: string;
  description?: string;
  instructor?: string;
}

interface UpdateCourseData {
  title?: string;
  description?: string;
  instructor?: string;
}

export class CourseService {
  private courseModel;
  private logger = createServiceLogger('CourseService');

  constructor(private fastify: FastifyInstance) {
    this.courseModel = getCourseModel();
  }

  async getCourses(
    request?: FastifyRequest,
    page: number = 1,
    limit: number = 10,
  ): Promise<PaginatedResult<Course>> {
    if (request) {
      request.log.debug({ page, limit }, 'Getting paginated courses');
    } else {
      this.logger.debug({ page, limit }, 'Getting paginated courses');
    }

    // Calculate skip value for pagination
    const skip = (page - 1) * limit;

    // Get total count for pagination
    const total = await this.courseModel.countDocuments();
    if (request) {
      request.log.debug({ total }, 'Total course count retrieved');
    } else {
      this.logger.debug({ total }, 'Total course count retrieved');
    }

    // Get courses with pagination
    const courses = await this.courseModel
      .find()
      .skip(skip)
      .limit(limit)
      .select('title description instructor createdAt updatedAt')
      .lean();

    if (request) {
      request.log.debug({ coursesCount: courses.length }, 'Courses retrieved successfully');
    } else {
      this.logger.debug({ coursesCount: courses.length }, 'Courses retrieved successfully');
    }

    return {
      data: courses.map((course) => ({
        ...course,
        _id: course._id.toString(),
        modules: course.modules?.map((module) => ({
          ...module,
          _id: module._id.toString(),
          lessons: module.lessons?.map((lesson) => ({
            ...lesson,
            _id: lesson._id.toString(),
          })),
        })),
      })) as Course[],
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
        hasNextPage: page * limit < total,
        hasPrevPage: page > 1,
      },
    };
  }

  async getCourseById(request: FastifyRequest, courseId: string): Promise<Course | null> {
    request.log.debug({ courseId }, 'Fetching course by ID');

    const course = await this.courseModel.findById(courseId).lean();

    if (!course) {
      request.log.info({ courseId }, 'Course not found');
      return null;
    }

    request.log.debug(
      {
        courseId,
        courseTitle: course.title,
        hasModules: course.modules?.length > 0,
        moduleCount: course.modules?.length || 0,
        ...withLogglyTags(['course-fetch']),
      },
      'Course retrieved successfully',
    );

    // Transform the document using CourseHelpers
    const courseObj = course as any;
    return {
      ...courseObj,
      _id: courseObj._id.toString(),
      modules: courseObj.modules?.map((module: any) => ({
        ...module,
        _id: module._id.toString(),
        lessons: module.lessons?.map((lesson: any) => ({
          ...lesson,
          _id: lesson._id.toString(),
        })),
      })),
    } as Course;
  }

  async createCourse(request: FastifyRequest, courseData: CreateCourseData): Promise<Course> {
    request.log.info(
      {
        courseTitle: courseData.title,
        hasDescription: !!courseData.description,
        hasInstructor: !!courseData.instructor,
        ...withLogglyTags(['course-create']),
      },
      'Creating new course',
    );

    try {
      const course = await this.courseModel.create({
        title: courseData.title,
        description: courseData.description || '',
        instructor: courseData.instructor || '',
        modules: [],
        totalLessons: 0,
        studentCount: 0,
        // Set default values for any missing fields
        featured: false,
        bestseller: false,
        newCourse: false,
        language: 'English',
      });

      request.log.info({ courseId: course._id.toString() }, 'Course created successfully');

      // Transform the MongoDB document to match the Course type
      const courseObj = course.toObject();
      return {
        ...courseObj,
        _id: courseObj._id.toString(),
        modules: courseObj.modules?.map((module: any) => ({
          ...module,
          _id: module._id.toString(),
          lessons: module.lessons?.map((lesson: any) => ({
            ...lesson,
            _id: lesson._id.toString(),
          })),
        })),
      } as Course;
    } catch (error) {
      request.log.error(
        {
          err: error,
          courseData: { title: courseData.title },
          ...withLogglyTags(['course-create-error']),
        },
        'Failed to create course',
      );
      throw error;
    }
  }

  async updateCourse(
    request: FastifyRequest,
    courseId: string,
    updateData: UpdateCourseData,
  ): Promise<Course | null> {
    request.log.info(
      {
        courseId,
        updateFields: Object.keys(updateData),
        ...withLogglyTags(['course-update']),
      },
      'Updating course',
    );

    try {
      const course = await this.courseModel
        .findByIdAndUpdate(
          courseId,
          {
            $set: {
              ...updateData,
              updatedAt: new Date(),
            },
          },
          { new: true, runValidators: true },
        )
        .lean();

      if (!course) {
        request.log.warn({ courseId }, 'Course not found during update attempt');
        return null;
      }

      request.log.info(
        {
          courseId,
          courseTitle: course.title,
          ...withLogglyTags(['course-update-success']),
        },
        'Course updated successfully',
      );

      // Transform and return the course
      const courseObj = course as any;
      return {
        ...courseObj,
        _id: courseObj._id.toString(),
        modules: courseObj.modules?.map((module: any) => ({
          ...module,
          _id: module._id.toString(),
          lessons: module.lessons?.map((lesson: any) => ({
            ...lesson,
            _id: lesson._id.toString(),
          })),
        })),
      } as Course;
    } catch (error) {
      request.log.error(
        {
          err: error,
          courseId,
          updateData,
          ...withLogglyTags(['course-update-error']),
        },
        'Failed to update course',
      );
      throw error;
    }
  }

  async deleteCourse(request: FastifyRequest, courseId: string): Promise<boolean> {
    request.log.info({ courseId, ...withLogglyTags(['course-delete']) }, 'Deleting course');

    try {
      const result = await this.courseModel.findByIdAndDelete(courseId);

      if (result) {
        request.log.info(
          {
            courseId,
            courseTitle: result.title,
            ...withLogglyTags(['course-delete-success']),
          },
          'Course deleted successfully',
        );
        return true;
      } else {
        request.log.warn({ courseId }, 'Course not found during delete attempt');
        return false;
      }
    } catch (error) {
      request.log.error(
        {
          err: error,
          courseId,
          ...withLogglyTags(['course-delete-error']),
        },
        'Failed to delete course',
      );
      throw error;
    }
  }

  // Curriculum methods
  async getCourseCurriculum(request: FastifyRequest, courseId: string): Promise<Course | null> {
    request.log.debug(
      { courseId, ...withLogglyTags(['curriculum-fetch']) },
      'Fetching course curriculum',
    );

    const course = await this.courseModel.findById(courseId).lean();
    if (!course) {
      request.log.info({ courseId }, 'Course not found when fetching curriculum');
      return null;
    }

    // Sort modules by order
    const sortedModules = (course.modules || [])
      .map((module: any) => ({
        ...module,
        _id: module._id.toString(),
        lessons: (module.lessons || [])
          .map((lesson: any) => ({
            ...lesson,
            _id: lesson._id.toString(),
          }))
          .sort((a: any, b: any) => a.order - b.order),
      }))
      .sort((a: any, b: any) => a.order - b.order);

    request.log.debug(
      {
        courseId,
        moduleCount: sortedModules.length,
        ...withLogglyTags(['curriculum-success']),
      },
      'Curriculum retrieved successfully',
    );

    return {
      ...course,
      _id: course._id.toString(),
      modules: sortedModules,
    } as Course;
  }

  // Module methods
  async getModule(request: FastifyRequest, courseId: string, moduleId: string) {
    request.log.debug(
      { courseId, moduleId, ...withLogglyTags(['module-fetch']) },
      'Fetching module',
    );

    const module = await CourseHelpers.getModule(courseId, moduleId);

    if (!module) {
      request.log.info({ courseId, moduleId }, 'Module not found');
      return null;
    }

    request.log.debug(
      {
        courseId,
        moduleId,
        moduleTitle: module.title,
        lessonCount: module.lessons?.length || 0,
        ...withLogglyTags(['module-fetch-success']),
      },
      'Module retrieved successfully',
    );

    return module;
  }

  async getModuleByIds(request: FastifyRequest, courseId: string, moduleId: string) {
    request.log.debug(
      { courseId, moduleId, ...withLogglyTags(['module-fetch']) },
      'Fetching module',
    );

    const course = await this.courseModel.findById(courseId).exec();
    if (!course) {
      request.log.info({ courseId, moduleId }, 'Module not found');
      return null;
    }

    request.log.debug(
      {
        courseId,
        moduleId,
        moduleCount: course.modules.length,
        ...withLogglyTags(['module-fetch-success']),
      },
      'Module found in course',
    );

    return course;
  }

  async createModule(request: FastifyRequest, courseId: string, moduleData: CreateModulePayload) {
    request.log.info(
      {
        courseId,
        moduleTitle: moduleData.title,
        ...withLogglyTags(['module-create']),
      },
      'Creating new module',
    );

    try {
      const newModule = await CourseHelpers.addModule(courseId, moduleData);

      if (!newModule) {
        request.log.error({ courseId }, 'Failed to create module - course not found');
        throw new NotFoundError('Failed to create module');
      }

      request.log.info(
        {
          courseId,
          moduleId: newModule._id.toString(),
          moduleTitle: newModule.title,
          ...withLogglyTags(['module-create-success']),
        },
        'Module created successfully',
      );

      return newModule;
    } catch (error) {
      request.log.error(
        {
          err: error,
          courseId,
          moduleTitle: moduleData.title,
          ...withLogglyTags(['module-create-error']),
        },
        'Failed to create module',
      );
      throw error;
    }
  }

  async updateModule(
    request: FastifyRequest,
    courseId: string,
    moduleId: string,
    updateData: UpdateModulePayload,
  ) {
    request.log.info(
      {
        courseId,
        moduleId,
        updateFields: Object.keys(updateData),
        ...withLogglyTags(['module-update']),
      },
      'Updating module',
    );

    try {
      const updatedModule = await CourseHelpers.updateModule(courseId, moduleId, updateData);

      if (!updatedModule) {
        request.log.warn({ courseId, moduleId }, 'Module not found during update attempt');
        return null;
      }

      request.log.info(
        {
          courseId,
          moduleId,
          moduleTitle: updatedModule.title,
          ...withLogglyTags(['module-update-success']),
        },
        'Module updated successfully',
      );

      return updatedModule;
    } catch (error) {
      request.log.error(
        {
          err: error,
          courseId,
          moduleId,
          ...withLogglyTags(['module-update-error']),
        },
        'Failed to update module',
      );
      throw error;
    }
  }

  async deleteModule(
    request: FastifyRequest,
    courseId: string,
    moduleId: string,
  ): Promise<boolean> {
    request.log.info(
      {
        courseId,
        moduleId,
        ...withLogglyTags(['module-delete']),
      },
      'Deleting module',
    );

    try {
      const result = await CourseHelpers.deleteModule(courseId, moduleId);

      if (result) {
        request.log.info(
          {
            courseId,
            moduleId,
            ...withLogglyTags(['module-delete-success']),
          },
          'Module deleted successfully',
        );
      } else {
        request.log.warn({ courseId, moduleId }, 'Module not found during delete attempt');
      }

      return result;
    } catch (error) {
      request.log.error(
        {
          err: error,
          courseId,
          moduleId,
          ...withLogglyTags(['module-delete-error']),
        },
        'Failed to delete module',
      );
      throw error;
    }
  }

  // Lesson methods
  async getLesson(request: FastifyRequest, courseId: string, moduleId: string, lessonId: string) {
    request.log.debug(
      {
        courseId,
        moduleId,
        lessonId,
        ...withLogglyTags(['lesson-fetch']),
      },
      'Fetching lesson',
    );

    const lesson = await CourseHelpers.getLesson(courseId, moduleId, lessonId);

    if (!lesson) {
      request.log.info({ courseId, moduleId, lessonId }, 'Lesson not found');
      return null;
    }

    request.log.debug(
      {
        courseId,
        moduleId,
        lessonId,
        lessonTitle: lesson.title,
        ...withLogglyTags(['lesson-fetch-success']),
      },
      'Lesson retrieved successfully',
    );

    return lesson;
  }

  async createLesson(
    request: FastifyRequest,
    courseId: string,
    moduleId: string,
    lessonData: CreateLessonPayload,
  ) {
    request.log.info(
      {
        courseId,
        moduleId,
        lessonTitle: lessonData.title,
        ...withLogglyTags(['lesson-create']),
      },
      'Creating new lesson',
    );

    try {
      const newLesson = await CourseHelpers.addLesson(courseId, moduleId, lessonData);

      if (!newLesson) {
        request.log.error({ courseId, moduleId }, 'Failed to create lesson - module not found');
        throw new NotFoundError('Failed to create lesson');
      }

      request.log.info(
        {
          courseId,
          moduleId,
          lessonId: newLesson._id.toString(),
          lessonTitle: newLesson.title,
          ...withLogglyTags(['lesson-create-success']),
        },
        'Lesson created successfully',
      );

      return newLesson;
    } catch (error) {
      request.log.error(
        {
          err: error,
          courseId,
          moduleId,
          lessonTitle: lessonData.title,
          ...withLogglyTags(['lesson-create-error']),
        },
        'Failed to create lesson',
      );
      throw error;
    }
  }

  async updateLesson(
    request: FastifyRequest,
    courseId: string,
    moduleId: string,
    lessonId: string,
    updateData: UpdateLessonPayload,
  ) {
    request.log.info(
      {
        courseId,
        moduleId,
        lessonId,
        updateFields: Object.keys(updateData),
        ...withLogglyTags(['lesson-update']),
      },
      'Updating lesson',
    );

    try {
      const updatedLesson = await CourseHelpers.updateLesson(
        courseId,
        moduleId,
        lessonId,
        updateData,
      );

      if (!updatedLesson) {
        request.log.warn(
          { courseId, moduleId, lessonId },
          'Lesson not found during update attempt',
        );
        return null;
      }

      request.log.info(
        {
          courseId,
          moduleId,
          lessonId,
          lessonTitle: updatedLesson.title,
          ...withLogglyTags(['lesson-update-success']),
        },
        'Lesson updated successfully',
      );

      return updatedLesson;
    } catch (error) {
      request.log.error(
        {
          err: error,
          courseId,
          moduleId,
          lessonId,
          ...withLogglyTags(['lesson-update-error']),
        },
        'Failed to update lesson',
      );
      throw error;
    }
  }

  async deleteLesson(
    request: FastifyRequest,
    courseId: string,
    moduleId: string,
    lessonId: string,
  ): Promise<boolean> {
    request.log.info(
      {
        courseId,
        moduleId,
        lessonId,
        ...withLogglyTags(['lesson-delete']),
      },
      'Deleting lesson',
    );

    try {
      const result = await CourseHelpers.deleteLesson(courseId, moduleId, lessonId);

      if (result) {
        request.log.info(
          {
            courseId,
            moduleId,
            lessonId,
            ...withLogglyTags(['lesson-delete-success']),
          },
          'Lesson deleted successfully',
        );
      } else {
        request.log.warn(
          { courseId, moduleId, lessonId },
          'Lesson not found during delete attempt',
        );
      }

      return result;
    } catch (error) {
      request.log.error(
        {
          err: error,
          courseId,
          moduleId,
          lessonId,
          ...withLogglyTags(['lesson-delete-error']),
        },
        'Failed to delete lesson',
      );
      throw error;
    }
  }
}
