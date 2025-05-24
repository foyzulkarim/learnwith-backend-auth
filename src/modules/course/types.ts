export interface Course {
  _id: string;
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
  modules: Module[];
}

export interface Category {
  id: number;
  name: string;
}

export interface Module {
  _id: string;
  title: string;
  order: number;
  lessons: Lesson[];
}

export interface Lesson {
  _id: string;
  title: string;
  videoUrl: string;
  content: string;
  duration: string;
  order: number;
}

export interface Curriculum {
  courseId: number;
  modules: Module[];
}

// Request payloads
export interface CreateCoursePayload {
  title: string;
  description: string;
  thumbnailUrl: string;
  instructor: string;
  instructorAvatar?: string;
  price?: string;
  category: string;
  difficulty: string;
  featured?: boolean;
  bestseller?: boolean;
  newCourse?: boolean;
  language?: string;
}

export interface UpdateCoursePayload {
  title?: string;
  description?: string;
  thumbnailUrl?: string;
  instructor?: string;
  instructorAvatar?: string;
  price?: string;
  category?: string;
  difficulty?: string;
  featured?: boolean;
  bestseller?: boolean;
  newCourse?: boolean;
  language?: string;
}

export interface CreateModulePayload {
  title: string;
  order: number;
}

export interface UpdateModulePayload {
  title?: string;
  order?: number;
}

export interface CreateLessonPayload {
  title: string;
  videoUrl?: string;
  content?: string;
  duration?: string;
  order: number;
}

export interface UpdateLessonPayload {
  title?: string;
  videoUrl?: string;
  content?: string;
  duration?: string;
  order?: number;
}

// Response interfaces
export interface PaginatedCourseResponse {
  courses: Course[];
  total: number;
  page: number;
  limit: number;
}

export interface SuccessResponse {
  success: boolean;
}
