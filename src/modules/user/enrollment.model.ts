import mongoose, { Schema, Document } from 'mongoose';

// Interface for the enrollment document
export interface EnrollmentDocument extends Document {
  userId: mongoose.Types.ObjectId;
  courseId: mongoose.Types.ObjectId;
  enrolledAt: Date;
  lastAccessedAt: Date;
  lastWatchedLessonId: mongoose.Types.ObjectId | null;
  completedLessonIds: mongoose.Types.ObjectId[];
  progress: number; // Percentage of completion (0-100)
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
    completedLessonIds: [
      {
        type: Schema.Types.ObjectId,
        ref: 'Course.modules.lessons',
      },
    ],
    progress: {
      type: Number,
      default: 0,
    },
  },
  { timestamps: true },
);

// Create a compound index for userId and courseId to ensure uniqueness
EnrollmentSchema.index({ userId: 1, courseId: 1 }, { unique: true });

// Create indexes for efficient queries
EnrollmentSchema.index({ userId: 1 });
EnrollmentSchema.index({ courseId: 1 });

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
      completedLessonIds: [],
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
  updateLastWatchedLesson: async (userId: string, courseId: string, lessonId: string) => {
    const EnrollmentModel = getEnrollmentModel();

    const enrollment = await EnrollmentModel.findOne({
      userId: new mongoose.Types.ObjectId(userId),
      courseId: new mongoose.Types.ObjectId(courseId),
    });

    if (!enrollment) {
      // Auto-enroll if not already enrolled
      return EnrollmentModel.create({
        userId: new mongoose.Types.ObjectId(userId),
        courseId: new mongoose.Types.ObjectId(courseId),
        enrolledAt: new Date(),
        lastAccessedAt: new Date(),
        lastWatchedLessonId: new mongoose.Types.ObjectId(lessonId),
        completedLessonIds: [],
        progress: 0,
      });
    }

    enrollment.lastWatchedLessonId = new mongoose.Types.ObjectId(lessonId);
    enrollment.lastAccessedAt = new Date();
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
        completedLessonIds: [new mongoose.Types.ObjectId(lessonId)],
        progress: totalLessons > 0 ? (1 / totalLessons) * 100 : 0,
      });

      return newEnrollment;
    }

    // Check if lesson is already marked as completed
    const lessonObjectId = new mongoose.Types.ObjectId(lessonId);
    if (
      !enrollment.completedLessonIds.some((id: mongoose.Types.ObjectId) =>
        id.equals(lessonObjectId),
      )
    ) {
      enrollment.completedLessonIds.push(lessonObjectId);

      // Update progress
      if (totalLessons > 0) {
        enrollment.progress = (enrollment.completedLessonIds.length / totalLessons) * 100;
      }
    }

    enrollment.lastAccessedAt = new Date();
    enrollment.lastWatchedLessonId = lessonObjectId;
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

    return {
      enrolled: true,
      enrolledAt: enrollment.enrolledAt,
      lastAccessedAt: enrollment.lastAccessedAt,
      lastWatchedLessonId: enrollment.lastWatchedLessonId
        ? enrollment.lastWatchedLessonId.toString()
        : null,
      completedLessons: enrollment.completedLessonIds.length,
      completedLessonIds: enrollment.completedLessonIds.map((id: mongoose.Types.ObjectId) =>
        id.toString(),
      ),
      progress: enrollment.progress,
    };
  },
};
