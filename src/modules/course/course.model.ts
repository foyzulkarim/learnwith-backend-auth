import mongoose, { Schema, Document } from 'mongoose';
import { Course } from './types';

export interface CourseDocument extends Omit<Course, 'id' | 'isNew'>, Document {
  id: number;
  newCourse?: boolean; // renamed from isNew
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
  featured: { type: Boolean, default: false },
  bestseller: { type: Boolean, default: false },
  newCourse: { type: Boolean, default: false }, // renamed from isNew
  totalLessons: { type: Number, required: true },
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
});

export const getCourseModel = () => {
  return mongoose.models.Course || mongoose.model<CourseDocument>('Course', CourseSchema);
};

// Module interface and model
export interface ModuleDocument extends Document {
  id: number;
  title: string;
  courseId: number;
  order: number;
}

const ModuleSchema = new Schema<ModuleDocument>({
  id: { type: Number, required: true, unique: true },
  title: { type: String, required: true },
  courseId: { type: Number, required: true },
  order: { type: Number, required: true },
});

export const getModuleModel = () => {
  return mongoose.models.Module || mongoose.model<ModuleDocument>('Module', ModuleSchema);
};

// Lesson interface and model
export interface LessonDocument extends Document {
  id: number;
  title: string;
  moduleId: number;
  courseId: number;
  videoUrl: string;
  content: string;
  duration: string;
  order: number;
}

const LessonSchema = new Schema<LessonDocument>({
  id: { type: Number, required: true, unique: true },
  title: { type: String, required: true },
  moduleId: { type: Number, required: true },
  courseId: { type: Number, required: true },
  videoUrl: { type: String, default: '' },
  content: { type: String, default: '' },
  duration: { type: String, default: '00:00' },
  order: { type: Number, required: true },
});

export const getLessonModel = () => {
  return mongoose.models.Lesson || mongoose.model<LessonDocument>('Lesson', LessonSchema);
};
