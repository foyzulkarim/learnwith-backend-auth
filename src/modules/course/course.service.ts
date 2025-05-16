import { FastifyInstance } from 'fastify';
import { getCourseModel, CourseDocument, getModuleModel, getLessonModel } from './course.model';
import { Course, Category, Module, Lesson } from './types';

interface CourseFilters {
  search?: string;
  categoryId?: number;
  limit?: number;
}

export class CourseService {
  private courseModel;
  private moduleModel;
  private lessonModel;

  constructor(private fastify: FastifyInstance) {
    this.courseModel = getCourseModel();
    this.moduleModel = getModuleModel();
    this.lessonModel = getLessonModel();
  }

  async getAllCourses(filters?: CourseFilters): Promise<Course[]> {
    const query: any = {};

    // Apply filters if provided
    if (filters) {
      if (filters.search) {
        // Case-insensitive search on title
        query.title = { $regex: filters.search, $options: 'i' };
      }

      if (filters.categoryId) {
        query.categoryId = filters.categoryId;
      }
    }

    let coursesQuery = this.courseModel.find(query);

    // Apply limit if provided
    if (filters?.limit) {
      coursesQuery = coursesQuery.limit(filters.limit);
    }

    const courses = await coursesQuery.exec();
    return courses.map(this.convertToCourse);
  }

  async getCourseById(courseId: number): Promise<Course | null> {
    const course = await this.courseModel.findOne({ id: courseId });
    if (!course) return null;
    return this.convertToCourse(course);
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

  // Course CRUD operations
  async createCourse(courseData: Omit<Course, 'id'>): Promise<Course> {
    console.log('Creating course with data:', JSON.stringify(courseData, null, 2));

    // Generate a new course ID
    const lastCourse = await this.courseModel.findOne().sort({ id: -1 }).exec();
    const newId = lastCourse ? lastCourse.id + 1 : 1;

    // Create the course with defaults for required fields
    const courseToCreate = {
      ...courseData,
      id: newId,
      totalLessons: courseData.totalLessons || 0,
      instructor: courseData.instructor || 'Course Instructor',
      newCourse: courseData.isNew, // Map isNew to newCourse for database
      // Ensure required fields have defaults
      difficulty: courseData.difficulty || 'beginner',
      thumbnail: courseData.thumbnail || 'https://placeholder.com/400x300',
    };

    console.log('Course to save:', JSON.stringify(courseToCreate, null, 2));
    try {
      const created = await this.courseModel.create(courseToCreate);
      console.log('Course created successfully:', created.id);
      return this.convertToCourse(created);
    } catch (error) {
      console.error('Error creating course:', error);
      throw error;
    }
  }

  async updateCourse(courseId: number, courseData: Partial<Course>): Promise<Course | null> {
    // Map isNew to newCourse for database if it's included
    const dataToUpdate: any = { ...courseData };
    if ('isNew' in dataToUpdate) {
      dataToUpdate.newCourse = dataToUpdate.isNew;
      delete dataToUpdate.isNew;
    }

    const course = await this.courseModel.findOneAndUpdate(
      { id: courseId },
      { $set: dataToUpdate },
      { new: true },
    );

    if (!course) return null;
    return this.convertToCourse(course);
  }

  async deleteCourse(courseId: number): Promise<boolean> {
    const result = await this.courseModel.deleteOne({ id: courseId });

    // Also delete all modules and lessons associated with this course
    await this.moduleModel.deleteMany({ courseId });
    await this.lessonModel.deleteMany({ courseId });

    return result.deletedCount > 0;
  }

  // Module operations
  async getCourseModules(courseId: number): Promise<Module[]> {
    const modules = await this.moduleModel.find({ courseId }).sort({ order: 1 }).exec();

    // For each module, fetch its lessons
    const modulesWithLessons = await Promise.all(
      modules.map(async (module) => {
        const lessons = await this.lessonModel
          .find({ moduleId: module.id })
          .sort({ order: 1 })
          .exec();
        return {
          id: module.id,
          title: module.title,
          courseId: module.courseId,
          order: module.order,
          lessons,
        };
      }),
    );

    return modulesWithLessons;
  }

  async createModule(moduleData: Omit<Module, 'id'>): Promise<Module> {
    // Generate a new module ID
    const lastModule = await this.moduleModel.findOne().sort({ id: -1 }).exec();
    const newId = lastModule ? lastModule.id + 1 : 1;

    const created = await this.moduleModel.create({
      ...moduleData,
      id: newId,
    });

    return {
      id: created.id,
      title: created.title,
      courseId: created.courseId,
      order: created.order,
      lessons: [],
    };
  }

  async updateModule(moduleId: number, moduleData: Partial<Module>): Promise<Module | null> {
    // Make sure to not update lessons through this method
    const { lessons: _, ...dataToUpdate } = moduleData;

    const module = await this.moduleModel.findOneAndUpdate(
      { id: moduleId },
      { $set: dataToUpdate },
      { new: true },
    );

    if (!module) return null;

    // Get the lessons for this module
    const lessonsList = await this.lessonModel.find({ moduleId }).sort({ order: 1 }).exec();

    return {
      id: module.id,
      title: module.title,
      courseId: module.courseId,
      order: module.order,
      lessons: lessonsList,
    };
  }

  async deleteModule(moduleId: number): Promise<boolean> {
    const result = await this.moduleModel.deleteOne({ id: moduleId });

    // Also delete all lessons in this module
    await this.lessonModel.deleteMany({ moduleId });

    return result.deletedCount > 0;
  }

  // Lesson operations
  async createLesson(lessonData: Omit<Lesson, 'id'>): Promise<Lesson> {
    // Generate a new lesson ID
    const lastLesson = await this.lessonModel.findOne().sort({ id: -1 }).exec();
    const newId = lastLesson ? lastLesson.id + 1 : 1;

    const created = await this.lessonModel.create({
      ...lessonData,
      id: newId,
    });

    // Update the course's totalLessons count
    await this.courseModel.updateOne({ id: lessonData.courseId }, { $inc: { totalLessons: 1 } });

    return {
      id: created.id,
      title: created.title,
      moduleId: created.moduleId,
      courseId: created.courseId,
      videoUrl: created.videoUrl,
      content: created.content,
      duration: created.duration,
      order: created.order,
    };
  }

  async updateLesson(lessonId: number, lessonData: Partial<Lesson>): Promise<Lesson | null> {
    const lesson = await this.lessonModel.findOneAndUpdate(
      { id: lessonId },
      { $set: lessonData },
      { new: true },
    );

    if (!lesson) return null;

    return {
      id: lesson.id,
      title: lesson.title,
      moduleId: lesson.moduleId,
      courseId: lesson.courseId,
      videoUrl: lesson.videoUrl,
      content: lesson.content,
      duration: lesson.duration,
      order: lesson.order,
    };
  }

  async deleteLesson(lessonId: number): Promise<boolean> {
    // Get the lesson's course ID before deleting
    const lesson = await this.lessonModel.findOne({ id: lessonId });
    if (!lesson) return false;

    const courseId = lesson.courseId;

    // Delete the lesson
    const result = await this.lessonModel.deleteOne({ id: lessonId });

    // Update the course's totalLessons count
    if (result.deletedCount > 0) {
      await this.courseModel.updateOne({ id: courseId }, { $inc: { totalLessons: -1 } });
    }

    return result.deletedCount > 0;
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

  async getCurriculum(courseId: number) {
    // Validate course exists
    const course = await this.courseModel.findOne({ id: courseId });
    if (!course) {
      throw new Error(`Course with id ${courseId} not found`);
    }

    // Get all modules for the course ordered by their order field
    const modules = await this.moduleModel.find({ courseId }).sort({ order: 1 }).exec();

    // For each module, get its lessons
    const modulesWithLessons = [];
    for (const module of modules) {
      // Get lessons for this module ordered by their order field
      const lessons = await this.lessonModel
        .find({ moduleId: module.id })
        .sort({ order: 1 })
        .exec();

      // Format the lessons to include necessary info
      const formattedLessons = lessons.map((lesson) => ({
        id: lesson.id,
        title: lesson.title,
        moduleId: lesson.moduleId,
        courseId: lesson.courseId,
        videoUrl: lesson.videoUrl,
        content: lesson.content,
        duration: lesson.duration,
        order: lesson.order,
        type: lesson.videoUrl ? 'Video' : 'Text', // Determine type based on if video URL exists
      }));

      // Add module with its lessons to the result
      modulesWithLessons.push({
        id: module.id,
        title: module.title,
        courseId: module.courseId,
        order: module.order,
        lessons: formattedLessons,
        lessonCount: formattedLessons.length,
      });
    }

    return {
      courseId,
      modules: modulesWithLessons,
    };
  }

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
