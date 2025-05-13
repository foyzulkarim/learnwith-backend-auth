export interface Course {
  id: number;
  title: string;
  description: string;
  thumbnail: string;
  instructor: string;
  instructorAvatar?: string;
  price?: string;
  rating?: string;
  categoryId: number;
  difficulty: string;
  featured?: boolean;
  bestseller?: boolean;
  isNew?: boolean;
  totalLessons: number;
  totalDuration?: string;
  lastUpdated?: string;
  language?: string;
  captions?: string[];
  studentCount?: number;
  completedLessons?: number;
  progress?: number;
  status?: string;
  publishedAt?: string;
  completionRate?: number;
}

export interface Category {
  id: number;
  name: string;
}

export interface Module {
  id: number;
  title: string;
  courseId: number;
  order: number;
  lessons?: Lesson[];
}

export interface Lesson {
  id: number;
  title: string;
  moduleId: number;
  courseId: number;
  videoUrl: string;
  content: string;
  duration: string;
  order: number;
}
