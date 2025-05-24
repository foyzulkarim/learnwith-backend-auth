import mongoose, { Schema, Document, Model } from 'mongoose';

// Lesson schema
export interface LessonDocument extends Document {
  _id: mongoose.Types.ObjectId;
  title: string;
  videoUrl: string;
  content: string;
  duration: string;
  order: number;
}

const LessonSchema = new Schema<LessonDocument>(
  {
    title: { type: String, required: true },
    videoUrl: { type: String, default: '' },
    content: { type: String, default: '' },
    duration: { type: String, default: '00:00' },
    order: { type: Number, required: true },
  },
  { timestamps: true },
);

// Module schema
export interface ModuleDocument extends Document {
  _id: mongoose.Types.ObjectId;
  title: string;
  order: number;
  lessons: LessonDocument[];
}

const ModuleSchema = new Schema<ModuleDocument>(
  {
    title: { type: String, required: true },
    order: { type: Number, required: true },
    lessons: [LessonSchema],
  },
  { timestamps: true },
);

// Course interface and schema
export interface CourseDocument extends Document {
  _id: mongoose.Types.ObjectId;
  title: string;
  description: string;
  thumbnailUrl: string;
  instructor: string;
  instructorAvatar?: string;
  price?: string;
  rating?: string;
  category: string;
  difficulty: string;
  featured: boolean;
  bestseller: boolean;
  newCourse: boolean;
  totalLessons: number;
  totalDuration?: string;
  lastUpdated?: string;
  language: string;
  captions?: string[];
  studentCount: number;
  completedLessons?: number;
  progress?: number;
  status?: string;
  publishedAt?: string;
  completionRate?: number;
  modules: ModuleDocument[];
}

const CourseSchema = new Schema<CourseDocument>(
  {
    title: { type: String, required: true },
    description: { type: String, required: true },
    thumbnailUrl: { type: String, required: true },
    instructor: { type: String, required: true },
    instructorAvatar: { type: String },
    price: { type: String },
    rating: { type: String },
    category: { type: String, required: true },
    difficulty: { type: String, required: true },
    featured: { type: Boolean, default: false },
    bestseller: { type: Boolean, default: false },
    newCourse: { type: Boolean, default: false },
    totalLessons: { type: Number, default: 0 },
    totalDuration: { type: String },
    lastUpdated: { type: String },
    language: { type: String, default: 'English' },
    captions: { type: [String] },
    studentCount: { type: Number, default: 0 },
    completedLessons: { type: Number },
    progress: { type: Number },
    status: { type: String },
    publishedAt: { type: String },
    completionRate: { type: Number },
    modules: [ModuleSchema],
  },
  { timestamps: true },
);

// Indexes for better query performance
CourseSchema.index({ category: 1 });
CourseSchema.index({ instructor: 1 });
CourseSchema.index({ difficulty: 1 });
CourseSchema.index({ featured: 1 });
// Index for efficient lesson lookup
CourseSchema.index({ 'modules._id': 1, 'modules.lessons._id': 1 });

// Pre-save hook to calculate totalLessons
CourseSchema.pre('save', function (next) {
  // Count total lessons across all modules
  this.totalLessons = this.modules.reduce((total, module) => total + module.lessons.length, 0);

  // Calculate totalDuration if lessons have durations
  const totalSeconds = this.modules.reduce((total, module) => {
    return (
      total +
      module.lessons.reduce((moduleTotal, lesson) => {
        if (lesson.duration) {
          // Parse duration in format hh:mm:ss
          const parts = lesson.duration.split(':').map(Number);
          const seconds = (parts[0] || 0) * 3600 + (parts[1] || 0) * 60 + (parts[2] || 0);
          return moduleTotal + seconds;
        }
        return moduleTotal;
      }, 0)
    );
  }, 0);

  // Format total seconds back to hh:mm:ss
  if (totalSeconds > 0) {
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;
    this.totalDuration = `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
  }

  next();
});

// Pre-save hook to generate ObjectIDs for new documents
CourseSchema.pre('save', function (next) {
  // Generate IDs for new modules and lessons
  for (const module of this.modules) {
    if (!module._id) {
      module._id = new mongoose.Types.ObjectId();
    }

    // Generate IDs for new lessons
    for (const lesson of module.lessons) {
      if (!lesson._id) {
        lesson._id = new mongoose.Types.ObjectId();
      }
    }
  }

  next();
});

// Model getter
export const getCourseModel = (): Model<CourseDocument> => {
  return (
    (mongoose.models.Course as Model<CourseDocument>) ||
    mongoose.model<CourseDocument>('Course', CourseSchema)
  );
};

// Helper methods for the course model
export const CourseHelpers = {
  // Get a module by ID
  getModule: async (courseId: string, moduleId: string) => {
    const CourseModel = getCourseModel();
    const course = await CourseModel.findById(courseId);
    if (!course) return null;
    return course.modules.find((m) => m._id.toString() === moduleId) || null;
  },

  // Add a new module
  addModule: async (courseId: string, moduleData: { title: string; order: number }) => {
    const CourseModel = getCourseModel();
    const course = await CourseModel.findById(courseId);
    if (!course) throw new Error('Course not found');

    const newModule = {
      title: moduleData.title,
      order: moduleData.order,
      lessons: [],
    };

    course.modules.push(newModule as any);
    await course.save();
    return course.modules[course.modules.length - 1];
  },

  // Update a module
  updateModule: async (
    courseId: string,
    moduleId: string,
    moduleData: Partial<{ title: string; order: number }>,
  ) => {
    const CourseModel = getCourseModel();
    const course = await CourseModel.findById(courseId);
    if (!course) throw new Error('Course not found');

    const moduleIndex = course.modules.findIndex((m) => m._id.toString() === moduleId);
    if (moduleIndex === -1) throw new Error('Module not found');

    // Update module properties
    if (moduleData.title) course.modules[moduleIndex].title = moduleData.title;
    if (moduleData.order !== undefined) course.modules[moduleIndex].order = moduleData.order;

    await course.save();
    return course.modules[moduleIndex];
  },

  // Delete a module
  deleteModule: async (courseId: string, moduleId: string) => {
    const CourseModel = getCourseModel();
    const course = await CourseModel.findById(courseId);
    if (!course) throw new Error('Course not found');

    const moduleIndex = course.modules.findIndex((m) => m._id.toString() === moduleId);
    if (moduleIndex === -1) throw new Error('Module not found');

    course.modules.splice(moduleIndex, 1);
    await course.save();
    return true;
  },

  // Get a lesson
  getLesson: async (courseId: string, moduleId: string, lessonId: string) => {
    const CourseModel = getCourseModel();
    // Direct query for course with matching lesson ID
    const course = await CourseModel.findOne({
      _id: courseId,
      'modules._id': moduleId,
      'modules.lessons._id': lessonId,
    });

    if (!course) return null;

    // Find the module and lesson in the returned document
    const module = course.modules.find((m) => m._id.toString() === moduleId);
    if (!module) return null;

    return module.lessons.find((l) => l._id.toString() === lessonId) || null;
  },

  getLessonById: async (lessonId: string) => {
    const CourseModel = getCourseModel();
    // Direct query for course with matching lesson ID
    const course = await CourseModel.findOne({
      'modules.lessons._id': lessonId,
    });

    if (!course) return null;

    // Find the module and lesson in the returned document
    const module = course.modules.find((m) => m.lessons.some((l) => l._id.toString() === lessonId));
    if (!module) return null;

    return module.lessons.find((l) => l._id.toString() === lessonId) || null;
  },

  // Add a lesson
  addLesson: async (
    courseId: string,
    moduleId: string,
    lessonData: {
      title: string;
      videoUrl?: string;
      content?: string;
      duration?: string;
      order: number;
    },
  ) => {
    const CourseModel = getCourseModel();
    const course = await CourseModel.findById(courseId);
    if (!course) throw new Error('Course not found');

    const moduleIndex = course.modules.findIndex((m) => m._id.toString() === moduleId);
    if (moduleIndex === -1) throw new Error('Module not found');

    const newLesson = {
      title: lessonData.title,
      videoUrl: lessonData.videoUrl || '',
      content: lessonData.content || '',
      duration: lessonData.duration || '00:00',
      order: lessonData.order,
    };

    course.modules[moduleIndex].lessons.push(newLesson as any);
    await course.save();
    return course.modules[moduleIndex].lessons[course.modules[moduleIndex].lessons.length - 1];
  },

  // Update a lesson
  updateLesson: async (
    courseId: string,
    moduleId: string,
    lessonId: string,
    lessonData: Partial<{
      title: string;
      videoUrl: string;
      content: string;
      duration: string;
      order: number;
    }>,
  ) => {
    const CourseModel = getCourseModel();
    const course = await CourseModel.findById(courseId);
    if (!course) throw new Error('Course not found');

    const moduleIndex = course.modules.findIndex((m) => m._id.toString() === moduleId);
    if (moduleIndex === -1) throw new Error('Module not found');

    const lessonIndex = course.modules[moduleIndex].lessons.findIndex(
      (l) => l._id.toString() === lessonId,
    );
    if (lessonIndex === -1) throw new Error('Lesson not found');

    // Update lesson properties
    const lessonToUpdate = course.modules[moduleIndex].lessons[lessonIndex];
    if (lessonData.title) lessonToUpdate.title = lessonData.title;
    if (lessonData.videoUrl !== undefined) lessonToUpdate.videoUrl = lessonData.videoUrl;
    if (lessonData.content !== undefined) lessonToUpdate.content = lessonData.content;
    if (lessonData.duration !== undefined) lessonToUpdate.duration = lessonData.duration;
    if (lessonData.order !== undefined) lessonToUpdate.order = lessonData.order;

    await course.save();
    return course.modules[moduleIndex].lessons[lessonIndex];
  },

  // Delete a lesson
  deleteLesson: async (courseId: string, moduleId: string, lessonId: string) => {
    const CourseModel = getCourseModel();
    const course = await CourseModel.findById(courseId);
    if (!course) throw new Error('Course not found');

    const moduleIndex = course.modules.findIndex((m) => m._id.toString() === moduleId);
    if (moduleIndex === -1) throw new Error('Module not found');

    const lessonIndex = course.modules[moduleIndex].lessons.findIndex(
      (l) => l._id.toString() === lessonId,
    );
    if (lessonIndex === -1) throw new Error('Lesson not found');

    course.modules[moduleIndex].lessons.splice(lessonIndex, 1);
    await course.save();
    return true;
  },
};
