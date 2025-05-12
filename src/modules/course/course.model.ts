import mongoose, { Schema, Document } from 'mongoose';
import { Course } from './types';

export interface CourseDocument extends Omit<Course, 'id' | 'isNew'>, Document {
  id: number;
  isNew: boolean; // from Mongoose Document
}

const CourseSchema = new Schema<CourseDocument>({
  id: { type: Number, required: true, unique: true },
  title: { type: String, required: true },
  description: { type: String, required: true },
  thumbnail: { type: String, required: true },
  instructor: { type: String, required: true },
  instructorAvatar: { type: String },
  price: { type: String },
  rating: { type: String },
  categoryId: { type: Number, required: true },
  difficulty: { type: String, required: true },
  featured: { type: Boolean },
  bestseller: { type: Boolean },
  totalLessons: { type: Number },
  completedLessons: { type: Number },
  progress: { type: Number },
  status: { type: String },
  publishedAt: { type: String },
  studentCount: { type: Number },
  completionRate: { type: Number },
});

export const getCourseModel = () => {
  return mongoose.models.Course || mongoose.model<CourseDocument>('Course', CourseSchema);
};
