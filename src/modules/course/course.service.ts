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

export class CourseService {
  private courseModel;

  constructor(private fastify: FastifyInstance) {
    this.courseModel = getCourseModel();
  }

  async getAllCourses(page: number = 1, limit: number = 10) {
    // Calculate skip value for pagination
    const skip = (page - 1) * limit;

    // Get total count for pagination
    const total = await this.courseModel.countDocuments();

    // Get courses with pagination
    const courses = await this.courseModel
      .find()
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean();

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
  }

  async getCourseById(courseId: string): Promise<Course | null> {
    const course = await this.courseModel.findById(courseId).lean();
    if (!course) return null;

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
  }

  async createCourse(courseData: CreateCoursePayload): Promise<Course> {
    const course = await this.courseModel.create({
      ...courseData,
      modules: [],
      totalLessons: 0,
      studentCount: 0,
      // Set default values for any missing fields
      featured: courseData.featured || false,
      bestseller: courseData.bestseller || false,
      newCourse: courseData.newCourse || false,
      language: courseData.language || 'English',
    });

    // Transform the MongoDB document to match the Course type
    const courseObj = course.toObject();
    return {
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
  }

  async updateCourse(courseId: string, courseData: UpdateCoursePayload): Promise<Course | null> {
    const course = await this.courseModel
      .findByIdAndUpdate(courseId, { $set: courseData }, { new: true, runValidators: true })
      .lean();

    if (!course) return null;

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
  }

  async deleteCourse(courseId: string): Promise<boolean> {
    const result = await this.courseModel.findByIdAndDelete(courseId);
    return !!result;
  }

  // Curriculum methods
  async getCurriculum(courseId: string) {
    const course = await this.courseModel.findById(courseId).lean();
    if (!course) return null;

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

    return { courseId, modules: sortedModules };
  }

  // Module methods
  async getModule(courseId: string, moduleId: string) {
    const module = await CourseHelpers.getModule(courseId, moduleId);
    if (!module) return null;
    return module;
  }

  async createModule(courseId: string, moduleData: CreateModulePayload) {
    const newModule = await CourseHelpers.addModule(courseId, moduleData);
    if (!newModule) throw new NotFoundError('Failed to create module');
    return newModule;
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
    console.log('Fetching lesson:', { lessonId, moduleId, courseId });
    const lesson = await CourseHelpers.getLesson(courseId, moduleId, lessonId);
    if (!lesson) return null;
    return lesson;
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
