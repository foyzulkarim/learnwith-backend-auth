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
  totalLessons?: number;
  completedLessons?: number;
  progress?: number;
  status?: string;
  publishedAt?: string;
  studentCount?: number;
  completionRate?: number;
}
