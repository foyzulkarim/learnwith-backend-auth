// src/modules/course/user-course.model.ts
import mongoose, { Schema, Document, Model } from 'mongoose';

export interface UserCourseDocument extends Document {
  _id: mongoose.Types.ObjectId;
  userId: mongoose.Types.ObjectId;
  courseId: mongoose.Types.ObjectId;
  enrolledAt: Date;
  expiresAt?: Date; // For time-limited access
  active: boolean; // Whether the enrollment is active
  completedLessons: mongoose.Types.ObjectId[];
  progress: number; // Percentage of completion 0-100
  lastAccessedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const UserCourseSchema = new Schema<UserCourseDocument>(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    courseId: { type: Schema.Types.ObjectId, ref: 'Course', required: true },
    enrolledAt: { type: Date, default: Date.now },
    expiresAt: { type: Date },
    active: { type: Boolean, default: true },
    completedLessons: [{ type: Schema.Types.ObjectId }],
    progress: { type: Number, default: 0 },
    lastAccessedAt: { type: Date },
  },
  { timestamps: true },
);

// Compound index for efficient lookups
UserCourseSchema.index({ userId: 1, courseId: 1 }, { unique: true });

// Model getter
export const getUserCourseModel = (): Model<UserCourseDocument> => {
  return (
    (mongoose.models.UserCourse as Model<UserCourseDocument>) ||
    mongoose.model<UserCourseDocument>('UserCourse', UserCourseSchema)
  );
};

// Helper methods for the user course model
export const UserCourseHelpers = {
  // Check if a user is enrolled in a course
  isUserEnrolled: async (userId: string, courseId: string): Promise<boolean> => {
    const UserCourseModel = getUserCourseModel();
    const enrollment = await UserCourseModel.findOne({
      userId: new mongoose.Types.ObjectId(userId),
      courseId: new mongoose.Types.ObjectId(courseId),
      active: true,
    });

    // Check if enrollment exists and is not expired
    if (enrollment && enrollment.expiresAt) {
      return enrollment.expiresAt > new Date();
    }

    return !!enrollment;
  },

  // Get all courses a user is enrolled in
  getUserCourses: async (userId: string) => {
    const UserCourseModel = getUserCourseModel();
    return await UserCourseModel.find({
      userId: new mongoose.Types.ObjectId(userId),
      active: true,
    }).populate('courseId');
  },

  // Enroll a user in a course
  enrollUserInCourse: async (userId: string, courseId: string, expiresAt?: Date) => {
    const UserCourseModel = getUserCourseModel();

    // Check if enrollment already exists
    const existingEnrollment = await UserCourseModel.findOne({
      userId: new mongoose.Types.ObjectId(userId),
      courseId: new mongoose.Types.ObjectId(courseId),
    });

    if (existingEnrollment) {
      // Update existing enrollment
      existingEnrollment.active = true;
      if (expiresAt) existingEnrollment.expiresAt = expiresAt;
      return await existingEnrollment.save();
    } else {
      // Create new enrollment
      const newEnrollment = new UserCourseModel({
        userId: new mongoose.Types.ObjectId(userId),
        courseId: new mongoose.Types.ObjectId(courseId),
        expiresAt,
        active: true,
      });
      return await newEnrollment.save();
    }
  },

  // Update course progress
  updateCourseProgress: async (
    userId: string,
    courseId: string,
    lessonId: string,
    completed: boolean,
  ) => {
    const UserCourseModel = getUserCourseModel();
    const enrollment = await UserCourseModel.findOne({
      userId: new mongoose.Types.ObjectId(userId),
      courseId: new mongoose.Types.ObjectId(courseId),
    });

    if (!enrollment) return null;

    // Update completed lessons and last accessed time
    enrollment.lastAccessedAt = new Date();

    if (completed) {
      // Add lesson to completed lessons if not already there
      const lessonObjectId = new mongoose.Types.ObjectId(lessonId);
      if (!enrollment.completedLessons.some((id) => id.equals(lessonObjectId))) {
        enrollment.completedLessons.push(lessonObjectId);
      }
    } else {
      // Remove lesson from completed lessons
      enrollment.completedLessons = enrollment.completedLessons.filter(
        (id) => !id.equals(new mongoose.Types.ObjectId(lessonId)),
      );
    }

    // Recalculate progress (you'll need to get total lessons from course)
    // This is a placeholder - you'd actually want to query the course to get totalLessons
    // and calculate the percentage

    return await enrollment.save();
  },

  // Cancel a user's enrollment
  cancelEnrollment: async (userId: string, courseId: string) => {
    const UserCourseModel = getUserCourseModel();
    return await UserCourseModel.findOneAndUpdate(
      {
        userId: new mongoose.Types.ObjectId(userId),
        courseId: new mongoose.Types.ObjectId(courseId),
      },
      { active: false },
      { new: true },
    );
  },
};
