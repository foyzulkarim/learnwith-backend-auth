import mongoose from 'mongoose';
import { config } from '../config';
import { getCourseModel } from '../modules/course/course.model';

const mockCourses = [
  {
    id: 1,
    title: 'JavaScript Fundamentals',
    description: 'Learn the core concepts of JavaScript programming language',
    thumbnail:
      'https://images.unsplash.com/photo-1555099962-4199c345e5dd?ixlib=rb-4.0.3&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D&auto=format&fit=crop&w=1770&q=80',
    instructor: 'Alex Morgan',
    instructorAvatar:
      'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?auto=format&fit=facearea&facepad=2&w=256&h=256&q=80',
    price: '$49.99',
    rating: '4.7',
    categoryId: 1,
    difficulty: 'Beginner',
    featured: true,
    bestseller: true,
    isNew: false,
    totalLessons: 12,
    completedLessons: 3,
    progress: 25,
    studentCount: 1245,
    completionRate: 87,
    status: 'published',
    publishedAt: '2023-03-15T00:00:00.000Z',
  },
  {
    id: 2,
    title: 'React for Beginners',
    description: 'Start building modern web applications with React',
    thumbnail:
      'https://images.unsplash.com/photo-1633356122544-f134324a6cee?ixlib=rb-4.0.3&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D&auto=format&fit=crop&w=1770&q=80',
    instructor: 'Mia Chen',
    instructorAvatar:
      'https://images.unsplash.com/photo-1438761681033-6461ffad8d80?auto=format&fit=facearea&facepad=2&w=256&h=256&q=80',
    price: '$59.99',
    rating: '4.9',
    categoryId: 1,
    difficulty: 'Intermediate',
    featured: true,
    bestseller: true,
    isNew: false,
    totalLessons: 15,
    completedLessons: 0,
    progress: 0,
    studentCount: 987,
    completionRate: 92,
    status: 'published',
    publishedAt: '2023-05-20T00:00:00.000Z',
  },
  {
    id: 3,
    title: 'Python for Data Science',
    description: 'Master Python for data analysis and machine learning',
    thumbnail:
      'https://images.unsplash.com/photo-1580894894513-541e068a3e2b?auto=format&fit=crop&w=1770&q=80',
    instructor: 'David Kim',
    instructorAvatar:
      'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?auto=format&fit=facearea&facepad=2&w=256&h=256&q=80',
    price: '$49.99',
    rating: '4.8',
    categoryId: 2,
    difficulty: 'Intermediate',
    featured: false,
    bestseller: true,
    isNew: false,
    totalLessons: 20,
    completedLessons: 8,
    progress: 40,
    studentCount: 1534,
    completionRate: 78,
    status: 'published',
    publishedAt: '2023-01-10T00:00:00.000Z',
  },
  {
    id: 4,
    title: 'Flutter App Development',
    description: 'Build cross-platform mobile apps with Flutter',
    thumbnail:
      'https://images.unsplash.com/photo-1551650975-87deedd944c3?ixlib=rb-4.0.3&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D&auto=format&fit=crop&w=1974&q=80',
    instructor: 'Samantha Lee',
    instructorAvatar:
      'https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=facearea&facepad=2&w=256&h=256&q=80',
    price: '$69.99',
    rating: '4.6',
    categoryId: 3,
    difficulty: 'Advanced',
    featured: false,
    bestseller: false,
    isNew: true,
    totalLessons: 18,
    completedLessons: 0,
    progress: 0,
    studentCount: 756,
    completionRate: 85,
    status: 'published',
    publishedAt: '2023-07-05T00:00:00.000Z',
  },
  {
    id: 5,
    title: 'UI/UX Design Principles',
    description: 'Learn the fundamentals of creating great user experiences',
    thumbnail:
      'https://images.unsplash.com/photo-1561070791-2526d30994b5?ixlib=rb-4.0.3&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D&auto=format&fit=crop&w=1000&q=80',
    instructor: 'Jessica Brown',
    instructorAvatar:
      'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=facearea&facepad=2&w=256&h=256&q=80',
    price: '$39.99',
    rating: '4.5',
    categoryId: 4,
    difficulty: 'Beginner',
    featured: true,
    bestseller: false,
    isNew: false,
    totalLessons: 10,
    completedLessons: 5,
    progress: 50,
    studentCount: 1032,
    completionRate: 91,
    status: 'published',
    publishedAt: '2023-02-18T00:00:00.000Z',
  },
];

async function seed() {
  await mongoose.connect(config.DATABASE_URL);
  const Course = getCourseModel();
  await Course.deleteMany({});
  await Course.insertMany(mockCourses);
  console.log('Seeded courses successfully!');
  await mongoose.disconnect();
}

seed().catch((err) => {
  console.error(err);
  process.exit(1);
});
