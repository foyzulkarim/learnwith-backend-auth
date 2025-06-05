import mongoose, { Schema, Document } from 'mongoose';

// Schema for tracking individual lesson progress
const LessonProgressSchema = new Schema(
  {
    lessonId: {
      type: Schema.Types.ObjectId,
      ref: 'Course.modules.lessons',
      required: true,
    },
    startedAt: {
      type: Date,
      default: Date.now,
    },
    completedAt: {
      type: Date,
    },
    lastAccessedAt: {
      type: Date,
      default: Date.now,
    },
    watchDuration: {
      type: Number,
      default: 0,
    }, // Time spent in seconds
    notes: {
      type: String,
    },
    bookmarked: {
      type: Boolean,
      default: false,
    },
    status: {
      type: String,
      enum: ['not_started', 'in_progress', 'completed'],
      default: 'not_started',
    },
  },
  { _id: false },
);

// Interface for lesson progress
export interface LessonProgress {
  lessonId: mongoose.Types.ObjectId;
  startedAt: Date;
  completedAt?: Date;
  lastAccessedAt: Date;
  watchDuration: number;
  notes?: string;
  bookmarked?: boolean;
  status: 'not_started' | 'in_progress' | 'completed';
  toObject(): any; // For mongoose document conversion
}

// Interface for the enrollment document
export interface EnrollmentDocument extends Document {
  userId: mongoose.Types.ObjectId;
  courseId: mongoose.Types.ObjectId;
  enrolledAt: Date;
  lastAccessedAt: Date;
  lastWatchedLessonId: mongoose.Types.ObjectId | null;
  lessons: Map<string, LessonProgress>; // Map of lessonId to LessonProgress
  progress: number; // Percentage of completion (0-100)
  // Enhanced enrollment features
  certificateIssued: boolean;
  certificateUrl?: string;
  certificateIssuedAt?: Date;
  notes?: string; // Student's personal notes about the course
  rating?: number; // Student's rating of the course (1-5)
  feedback?: string; // Student's feedback about the course
}

// Schema for the enrollment
const EnrollmentSchema = new Schema<EnrollmentDocument>(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    courseId: {
      type: Schema.Types.ObjectId,
      ref: 'Course',
      required: true,
    },
    enrolledAt: {
      type: Date,
      default: Date.now,
    },
    lastAccessedAt: {
      type: Date,
      default: Date.now,
    },
    lastWatchedLessonId: {
      type: Schema.Types.ObjectId,
      ref: 'Course.modules.lessons',
      default: null,
    },
    lessons: {
      type: Map,
      of: LessonProgressSchema,
      default: () => new Map(),
    },
    progress: {
      type: Number,
      default: 0,
    },
    // Enhanced fields
    certificateIssued: {
      type: Boolean,
      default: false,
    },
    certificateUrl: {
      type: String,
    },
    certificateIssuedAt: {
      type: Date,
    },
    notes: {
      type: String,
    },
    rating: {
      type: Number,
      min: 1,
      max: 5,
    },
    feedback: {
      type: String,
    },
  },
  { timestamps: true },
);

// Create a compound index for userId and courseId to ensure uniqueness
EnrollmentSchema.index({ userId: 1, courseId: 1 }, { unique: true });

// Create indexes for efficient queries
EnrollmentSchema.index({ userId: 1 });
EnrollmentSchema.index({ courseId: 1 });
EnrollmentSchema.index({ progress: 1 }); // For finding courses in progress
EnrollmentSchema.index({ lastAccessedAt: -1 }); // For sorting by recent activity

// Model getter
export const getEnrollmentModel = () => {
  return (
    mongoose.models.Enrollment || mongoose.model<EnrollmentDocument>('Enrollment', EnrollmentSchema)
  );
};

// Helper methods for the enrollment model
export const EnrollmentHelpers = {
  // Enroll a user in a course
  enrollUserInCourse: async (userId: string, courseId: string) => {
    const EnrollmentModel = getEnrollmentModel();

    // Check if enrollment already exists
    const existingEnrollment = await EnrollmentModel.findOne({
      userId: new mongoose.Types.ObjectId(userId),
      courseId: new mongoose.Types.ObjectId(courseId),
    });

    if (existingEnrollment) {
      // Update last accessed time
      existingEnrollment.lastAccessedAt = new Date();
      await existingEnrollment.save();
      return existingEnrollment;
    }

    // Create new enrollment
    const enrollment = await EnrollmentModel.create({
      userId: new mongoose.Types.ObjectId(userId),
      courseId: new mongoose.Types.ObjectId(courseId),
      enrolledAt: new Date(),
      lastAccessedAt: new Date(),
      lastWatchedLessonId: null,
      lessons: new Map(),
      progress: 0,
    });

    return enrollment;
  },

  // Get all enrollments for a user
  getUserEnrollments: async (userId: string) => {
    const EnrollmentModel = getEnrollmentModel();
    return EnrollmentModel.find({
      userId: new mongoose.Types.ObjectId(userId),
    }).sort({ lastAccessedAt: -1 });
  },

  // Check if a user is enrolled in a course
  isUserEnrolled: async (userId: string, courseId: string) => {
    const EnrollmentModel = getEnrollmentModel();
    const enrollment = await EnrollmentModel.findOne({
      userId: new mongoose.Types.ObjectId(userId),
      courseId: new mongoose.Types.ObjectId(courseId),
    });

    return !!enrollment;
  },

  // Update the last watched lesson for a user
  updateLastWatchedLesson: async (
    userId: string,
    courseId: string,
    lessonId: string,
    duration?: number,
  ) => {
    const EnrollmentModel = getEnrollmentModel();

    const enrollment = await EnrollmentModel.findOne({
      userId: new mongoose.Types.ObjectId(userId),
      courseId: new mongoose.Types.ObjectId(courseId),
    });

    if (!enrollment) {
      // Auto-enroll if not already enrolled
      const newEnrollment = await EnrollmentModel.create({
        userId: new mongoose.Types.ObjectId(userId),
        courseId: new mongoose.Types.ObjectId(courseId),
        enrolledAt: new Date(),
        lastAccessedAt: new Date(),
        lastWatchedLessonId: new mongoose.Types.ObjectId(lessonId),
        lessons: new Map(),
        progress: 0,
      });

      // Initialize the lesson progress
      const lessonProgress = {
        lessonId: new mongoose.Types.ObjectId(lessonId),
        startedAt: new Date(),
        lastAccessedAt: new Date(),
        watchDuration: duration || 0,
        status: 'in_progress',
      };

      newEnrollment.lessons.set(lessonId, lessonProgress);
      await newEnrollment.save();

      return newEnrollment;
    }

    // Update last watched lesson
    enrollment.lastWatchedLessonId = new mongoose.Types.ObjectId(lessonId);
    enrollment.lastAccessedAt = new Date();

    // Update or create lesson progress
    const now = new Date();
    if (enrollment.lessons.has(lessonId)) {
      const lessonProgress = enrollment.lessons.get(lessonId);
      lessonProgress.lastAccessedAt = now;

      // Update watch duration if provided
      if (duration) {
        lessonProgress.watchDuration = (lessonProgress.watchDuration || 0) + duration;
      }

      enrollment.lessons.set(lessonId, lessonProgress);
    } else {
      // Initialize the lesson progress
      const lessonProgress = {
        lessonId: new mongoose.Types.ObjectId(lessonId),
        startedAt: now,
        lastAccessedAt: now,
        watchDuration: duration || 0,
        status: 'in_progress',
      };

      enrollment.lessons.set(lessonId, lessonProgress);
    }

    await enrollment.save();

    return enrollment;
  },

  // Mark a lesson as completed
  markLessonAsCompleted: async (
    userId: string,
    courseId: string,
    lessonId: string,
    totalLessons: number,
  ) => {
    const EnrollmentModel = getEnrollmentModel();

    const enrollment = await EnrollmentModel.findOne({
      userId: new mongoose.Types.ObjectId(userId),
      courseId: new mongoose.Types.ObjectId(courseId),
    });

    if (!enrollment) {
      // Auto-enroll if not already enrolled
      const newEnrollment = await EnrollmentModel.create({
        userId: new mongoose.Types.ObjectId(userId),
        courseId: new mongoose.Types.ObjectId(courseId),
        enrolledAt: new Date(),
        lastAccessedAt: new Date(),
        lastWatchedLessonId: new mongoose.Types.ObjectId(lessonId),
        lessons: new Map(),
        progress: totalLessons > 0 ? (1 / totalLessons) * 100 : 0,
      });

      // Initialize the lesson progress as completed
      const lessonProgress = {
        lessonId: new mongoose.Types.ObjectId(lessonId),
        startedAt: new Date(),
        completedAt: new Date(),
        lastAccessedAt: new Date(),
        watchDuration: 0,
        status: 'completed',
      };

      newEnrollment.lessons.set(lessonId, lessonProgress);
      await newEnrollment.save();

      return newEnrollment;
    }

    // Update or create lesson progress
    const now = new Date();
    if (enrollment.lessons.has(lessonId)) {
      const lessonProgress = enrollment.lessons.get(lessonId);
      lessonProgress.lastAccessedAt = now;
      lessonProgress.completedAt = now;
      lessonProgress.status = 'completed';

      enrollment.lessons.set(lessonId, lessonProgress);
    } else {
      // Initialize the lesson progress as completed
      const lessonProgress = {
        lessonId: new mongoose.Types.ObjectId(lessonId),
        startedAt: now,
        completedAt: now,
        lastAccessedAt: now,
        watchDuration: 0,
        status: 'completed',
      };

      enrollment.lessons.set(lessonId, lessonProgress);
    }

    // Update last watched lesson
    enrollment.lastWatchedLessonId = new mongoose.Types.ObjectId(lessonId);
    enrollment.lastAccessedAt = now;

    // Calculate progress based on completed lessons
    const completedLessons = Array.from(enrollment.lessons.values()).filter(
      (value): value is LessonProgress => {
        const lesson = value as LessonProgress;
        return lesson.status === 'completed';
      },
    ).length;

    enrollment.progress = totalLessons > 0 ? (completedLessons / totalLessons) * 100 : 0;

    await enrollment.save();

    return enrollment;
  },

  // Add or update lesson notes
  updateLessonNotes: async (userId: string, courseId: string, lessonId: string, notes: string) => {
    const EnrollmentModel = getEnrollmentModel();

    const enrollment = await EnrollmentModel.findOne({
      userId: new mongoose.Types.ObjectId(userId),
      courseId: new mongoose.Types.ObjectId(courseId),
    });

    if (!enrollment) {
      throw new Error('User is not enrolled in this course');
    }

    // Update or create lesson progress
    const now = new Date();
    if (enrollment.lessons.has(lessonId)) {
      const lessonProgress = enrollment.lessons.get(lessonId);
      lessonProgress.lastAccessedAt = now;
      lessonProgress.notes = notes;

      enrollment.lessons.set(lessonId, lessonProgress);
    } else {
      // Initialize the lesson progress with notes
      const lessonProgress = {
        lessonId: new mongoose.Types.ObjectId(lessonId),
        startedAt: now,
        lastAccessedAt: now,
        watchDuration: 0,
        notes: notes,
        status: 'in_progress',
      };

      enrollment.lessons.set(lessonId, lessonProgress);
    }

    enrollment.lastAccessedAt = now;
    await enrollment.save();

    return enrollment;
  },

  // Toggle lesson bookmark
  toggleLessonBookmark: async (userId: string, courseId: string, lessonId: string) => {
    const EnrollmentModel = getEnrollmentModel();

    const enrollment = await EnrollmentModel.findOne({
      userId: new mongoose.Types.ObjectId(userId),
      courseId: new mongoose.Types.ObjectId(courseId),
    });

    if (!enrollment) {
      throw new Error('User is not enrolled in this course');
    }

    // Update or create lesson progress
    const now = new Date();
    if (enrollment.lessons.has(lessonId)) {
      const lessonProgress = enrollment.lessons.get(lessonId);
      lessonProgress.lastAccessedAt = now;
      lessonProgress.bookmarked = !lessonProgress.bookmarked;

      enrollment.lessons.set(lessonId, lessonProgress);
    } else {
      // Initialize the lesson progress with bookmark
      const lessonProgress = {
        lessonId: new mongoose.Types.ObjectId(lessonId),
        startedAt: now,
        lastAccessedAt: now,
        watchDuration: 0,
        bookmarked: true,
        status: 'in_progress',
      };

      enrollment.lessons.set(lessonId, lessonProgress);
    }

    enrollment.lastAccessedAt = now;
    await enrollment.save();

    return enrollment;
  },

  // Get the last watched lesson for a user in a course
  getLastWatchedLesson: async (userId: string, courseId: string) => {
    const EnrollmentModel = getEnrollmentModel();

    const enrollment = await EnrollmentModel.findOne({
      userId: new mongoose.Types.ObjectId(userId),
      courseId: new mongoose.Types.ObjectId(courseId),
    });

    if (!enrollment || !enrollment.lastWatchedLessonId) {
      return null;
    }

    return enrollment.lastWatchedLessonId.toString();
  },

  // Get all lesson progress for a course
  getLessonProgress: async (userId: string, courseId: string) => {
    const EnrollmentModel = getEnrollmentModel();

    const enrollment = await EnrollmentModel.findOne({
      userId: new mongoose.Types.ObjectId(userId),
      courseId: new mongoose.Types.ObjectId(courseId),
    });

    if (!enrollment) {
      return null;
    }

    // Convert Map to array of objects with lessonId as key
    const lessonProgress = Array.from(enrollment.lessons.entries()).map((entry) => {
      const [id, progress] = entry as [string, LessonProgress];
      const progressObj = progress.toObject ? progress.toObject() : progress;
      return {
        lessonId: id,
        ...progressObj,
      };
    });

    return lessonProgress;
  },

  // Get enrollment details for a user in a course
  getEnrollmentDetails: async (userId: string, courseId: string) => {
    const EnrollmentModel = getEnrollmentModel();

    const enrollment = await EnrollmentModel.findOne({
      userId: new mongoose.Types.ObjectId(userId),
      courseId: new mongoose.Types.ObjectId(courseId),
    });

    if (!enrollment) {
      return null;
    }

    // Convert lessons Map to a more JSON-friendly format
    const lessons: Record<string, any> = {};
    enrollment.lessons.forEach((value: LessonProgress, key: string) => {
      lessons[key] = {
        ...value.toObject(),
        lessonId: value.lessonId.toString(),
      };
    });

    return {
      enrolled: true,
      enrolledAt: enrollment.enrolledAt,
      lastAccessedAt: enrollment.lastAccessedAt,
      lastWatchedLessonId: enrollment.lastWatchedLessonId
        ? enrollment.lastWatchedLessonId.toString()
        : null,
      lessons: lessons,
      completedLessons: Array.from(enrollment.lessons.values()).filter(
        (value): value is LessonProgress => {
          const lesson = value as LessonProgress;
          return lesson.status === 'completed';
        },
      ).length,
      progress: enrollment.progress,
      certificateIssued: enrollment.certificateIssued,
      certificateUrl: enrollment.certificateUrl,
      notes: enrollment.notes,
      rating: enrollment.rating,
      feedback: enrollment.feedback,
    };
  },

  // Add or update notes for a course
  addCourseNotes: async (userId: string, courseId: string, notes: string) => {
    const EnrollmentModel = getEnrollmentModel();

    const enrollment = await EnrollmentModel.findOne({
      userId: new mongoose.Types.ObjectId(userId),
      courseId: new mongoose.Types.ObjectId(courseId),
    });

    if (!enrollment) {
      throw new Error('User is not enrolled in this course');
    }

    enrollment.notes = notes;
    enrollment.lastAccessedAt = new Date();
    await enrollment.save();

    return enrollment;
  },

  // Add rating and feedback for a course
  addCourseRating: async (userId: string, courseId: string, rating: number, feedback?: string) => {
    const EnrollmentModel = getEnrollmentModel();

    const enrollment = await EnrollmentModel.findOne({
      userId: new mongoose.Types.ObjectId(userId),
      courseId: new mongoose.Types.ObjectId(courseId),
    });

    if (!enrollment) {
      throw new Error('User is not enrolled in this course');
    }

    enrollment.rating = rating;
    if (feedback) {
      enrollment.feedback = feedback;
    }
    enrollment.lastAccessedAt = new Date();
    await enrollment.save();

    return enrollment;
  },

  // Issue a certificate for a completed course
  issueCertificate: async (userId: string, courseId: string, certificateUrl: string) => {
    const EnrollmentModel = getEnrollmentModel();

    const enrollment = await EnrollmentModel.findOne({
      userId: new mongoose.Types.ObjectId(userId),
      courseId: new mongoose.Types.ObjectId(courseId),
    });

    if (!enrollment) {
      throw new Error('User is not enrolled in this course');
    }

    // Only issue certificate if progress is 100%
    if (enrollment.progress < 100) {
      throw new Error('Course must be completed before issuing a certificate');
    }

    enrollment.certificateIssued = true;
    enrollment.certificateUrl = certificateUrl;
    enrollment.certificateIssuedAt = new Date();
    await enrollment.save();

    return enrollment;
  },

  // Get all students enrolled in a course (for instructors/admins)
  getCourseEnrollments: async (courseId: string) => {
    const EnrollmentModel = getEnrollmentModel();

    return EnrollmentModel.find({
      courseId: new mongoose.Types.ObjectId(courseId),
    }).sort({ enrolledAt: -1 });
  },

  // Get course completion statistics (for instructors/admins)
  getCourseCompletionStats: async (courseId: string) => {
    const EnrollmentModel = getEnrollmentModel();

    const enrollments = await EnrollmentModel.find({
      courseId: new mongoose.Types.ObjectId(courseId),
    });

    const totalEnrollments = enrollments.length;
    const completedEnrollments = enrollments.filter((e) => e.progress === 100).length;
    const inProgressEnrollments = enrollments.filter(
      (e) => e.progress > 0 && e.progress < 100,
    ).length;
    const notStartedEnrollments = enrollments.filter((e) => e.progress === 0).length;

    const averageProgress =
      totalEnrollments > 0
        ? enrollments.reduce((sum, e) => sum + e.progress, 0) / totalEnrollments
        : 0;

    return {
      totalEnrollments,
      completedEnrollments,
      inProgressEnrollments,
      notStartedEnrollments,
      completionRate: totalEnrollments > 0 ? (completedEnrollments / totalEnrollments) * 100 : 0,
      averageProgress,
    };
  },
};
