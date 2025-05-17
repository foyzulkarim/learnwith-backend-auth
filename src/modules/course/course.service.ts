import { FastifyInstance } from 'fastify';
import { getCourseModel, CourseDocument, CourseHelpers } from './course.model';
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
      courses: courses as Course[],
      total,
    };
  }

  async getCourseById(courseId: string): Promise<Course | null> {
    const course = await this.courseModel.findById(courseId).lean();
    if (!course) return null;
    return course as Course;
  }

  async getCourseLessons(courseId: number): Promise<Lesson[]> {
    return this.lessonModel.find({ courseId }).sort({ order: 1 }).exec();
  }

  async getCategories(): Promise<Category[]> {
    // In a real application, this would come from a database
    // For now, returning mock data
    return [
      { id: 1, name: 'Web Development' },
      { id: 2, name: 'Data Science' },
      { id: 3, name: 'Machine Learning' },
      { id: 4, name: 'Mobile Development' },
      { id: 5, name: 'Cloud Computing' },
      { id: 6, name: 'DevOps' },
    ];
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

    return course.toObject() as Course;
  }

  async updateCourse(courseId: string, courseData: UpdateCoursePayload): Promise<Course | null> {
    const course = await this.courseModel
      .findByIdAndUpdate(courseId, { $set: courseData }, { new: true, runValidators: true })
      .lean();

    if (!course) return null;
    return course as Course;
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

  // New method for saving curriculum (modules and lessons together)
  async saveCurriculum(
    courseId: number | null,
    modules: {
      id: number;
      title: string;
      order: number;
      lessons: {
        id: number;
        title: string;
        order: number;
        videoUrl: string;
        content: string;
        duration: string;
      }[];
    }[],
  ) {
    // Validate courseId if provided
    if (courseId !== null) {
      const course = await this.courseModel.findOne({ id: courseId });
      if (!course) {
        throw new Error(`Course with id ${courseId} not found`);
      }
    }

    const savedModules = [];

    // Process each module
    for (const moduleData of modules) {
      let moduleId = moduleData.id;
      let module;

      // Check if module exists
      const existingModule = await this.moduleModel.findOne({ id: moduleId });

      if (existingModule) {
        // Update existing module
        module = await this.moduleModel.findOneAndUpdate(
          { id: moduleId },
          {
            title: moduleData.title,
            order: moduleData.order,
          },
          { new: true },
        );
      } else {
        // Create new module
        const lastModule = await this.moduleModel.findOne().sort({ id: -1 }).exec();
        moduleId = lastModule ? lastModule.id + 1 : 1;

        module = await this.moduleModel.create({
          id: moduleId,
          title: moduleData.title,
          courseId: courseId || 0, // If courseId is null, use 0 temporarily
          order: moduleData.order,
        });
      }

      const savedLessons = [];

      // Process each lesson in the module
      for (const lessonData of moduleData.lessons) {
        let lessonId = lessonData.id;
        let lesson;

        // Check if lesson exists
        const existingLesson = await this.lessonModel.findOne({ id: lessonId });

        if (existingLesson) {
          // Update existing lesson
          lesson = await this.lessonModel.findOneAndUpdate(
            { id: lessonId },
            {
              title: lessonData.title,
              videoUrl: lessonData.videoUrl,
              content: lessonData.content,
              duration: lessonData.duration,
              order: lessonData.order,
            },
            { new: true },
          );
        } else {
          // Create new lesson
          const lastLesson = await this.lessonModel.findOne().sort({ id: -1 }).exec();
          lessonId = lastLesson ? lastLesson.id + 1 : 1;

          lesson = await this.lessonModel.create({
            id: lessonId,
            title: lessonData.title,
            moduleId: moduleId,
            courseId: courseId || 0, // If courseId is null, use 0 temporarily
            videoUrl: lessonData.videoUrl || '',
            content: lessonData.content || '',
            duration: lessonData.duration || '00:00',
            order: lessonData.order,
          });
        }

        savedLessons.push({
          id: lesson.id,
          title: lesson.title,
          order: lesson.order,
          videoUrl: lesson.videoUrl,
          content: lesson.content,
          duration: lesson.duration,
        });
      }

      savedModules.push({
        id: module.id,
        title: module.title,
        order: module.order,
        lessons: savedLessons,
      });
    }

    // Update course totalLessons count if courseId is provided
    if (courseId) {
      const totalLessons = await this.lessonModel.countDocuments({ courseId });
      await this.courseModel.updateOne({ id: courseId }, { totalLessons });
    }

    return {
      courseId,
      modules: savedModules,
    };
  }

  // This method was removed as it was a duplicate of the getCurriculum method above
  // that works with the embedded document structure rather than separate collections.

  async updateModuleLesson(
    moduleId: number,
    lessonId: number,
    lessonData: Partial<Lesson>,
  ): Promise<Lesson | null> {
    // First check if the module exists
    const module = await this.moduleModel.findOne({ id: moduleId });
    if (!module) return null;

    // Then check if the lesson exists and belongs to this module
    const lesson = await this.lessonModel.findOne({ id: lessonId, moduleId });
    if (!lesson) return null;

    // Update the lesson
    const updatedLesson = await this.lessonModel.findOneAndUpdate(
      { id: lessonId },
      { $set: lessonData },
      { new: true },
    );

    return updatedLesson;
  }

  // Add a new method to get a lesson by course, module, and lesson IDs
  async getLessonByPath(
    courseId: number,
    moduleId: number,
    lessonId: number,
  ): Promise<Lesson | null> {
    // First check if the course exists
    const course = await this.courseModel.findOne({ id: courseId });
    if (!course) return null;

    // Then check if the module exists and belongs to this course
    const module = await this.moduleModel.findOne({ id: moduleId, courseId });
    if (!module) return null;

    // Finally check if the lesson exists and belongs to this module
    const lesson = await this.lessonModel.findOne({ id: lessonId, moduleId });
    return lesson;
  }

  private convertToCourse(courseDoc: CourseDocument): Course {
    const course = courseDoc.toObject();
    return {
      ...course,
      id: course.id,
      isNew: course.newCourse,
    };
  }
}
