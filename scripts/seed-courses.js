// Seed Courses Script
const mongoose = require('mongoose');
const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });

// Connect to MongoDB
mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/lmsai')
  .then(() => console.log('Connected to MongoDB'))
  .catch(err => {
    console.error('Could not connect to MongoDB', err);
    process.exit(1);
  });

// Define Course Schema
const CourseSchema = new mongoose.Schema({
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
  isNew: { type: Boolean },
  totalLessons: { type: Number },
  completedLessons: { type: Number },
  progress: { type: Number },
  status: { type: String },
  publishedAt: { type: String },
  studentCount: { type: Number },
  completionRate: { type: Number },
});

// Clear existing model if it exists to avoid OverwriteModelError
mongoose.models = {};
const Course = mongoose.model('Course', CourseSchema);

// Sample courses data
const courses = [
  {
    id: 1,
    title: "Introduction to Machine Learning",
    description: "Learn the fundamentals of machine learning algorithms and techniques.",
    thumbnail: "https://placehold.co/600x400?text=Machine+Learning",
    instructor: "Dr. Sarah Chen",
    instructorAvatar: "https://i.pravatar.cc/150?u=sarah",
    price: "$49.99",
    rating: "4.8",
    categoryId: 1,
    difficulty: "Beginner",
    featured: true,
    bestseller: true,
    isNew: false,
    totalLessons: 12,
    completedLessons: 0,
    progress: 0,
    status: "Active",
    publishedAt: "2023-05-15",
    studentCount: 75141,
    completionRate: 78
  },
  {
    id: 2,
    title: "Advanced JavaScript Development",
    description: "Master advanced JavaScript concepts, design patterns, and modern ES6+ features.",
    thumbnail: "https://placehold.co/600x400?text=JavaScript",
    instructor: "Mike Johnson",
    instructorAvatar: "https://i.pravatar.cc/150?u=mike",
    price: "$59.99",
    rating: "4.7",
    categoryId: 2,
    difficulty: "Intermediate",
    featured: false,
    bestseller: true,
    isNew: false,
    totalLessons: 15,
    completedLessons: 0,
    progress: 0,
    status: "Active",
    publishedAt: "2023-06-20",
    studentCount: 52380,
    completionRate: 82
  },
  {
    id: 3,
    title: "Full Stack Web Development",
    description: "Comprehensive guide to becoming a full stack web developer using modern technologies.",
    thumbnail: "https://placehold.co/600x400?text=Web+Development",
    instructor: "Alex Rodriguez",
    instructorAvatar: "https://i.pravatar.cc/150?u=alex",
    price: "$79.99",
    rating: "4.9",
    categoryId: 2,
    difficulty: "Advanced",
    featured: true,
    bestseller: false,
    isNew: true,
    totalLessons: 24,
    completedLessons: 0,
    progress: 0,
    status: "Active",
    publishedAt: "2023-08-10",
    studentCount: 31245,
    completionRate: 75
  }
];

// Function to seed courses
async function seedCourses() {
  try {
    // Delete existing courses
    await Course.deleteMany({});
    console.log('Deleted existing courses');

    // Insert new courses
    await Course.insertMany(courses);
    console.log(`Inserted ${courses.length} courses`);

    console.log('Database seeded successfully');
    process.exit(0);
  } catch (error) {
    console.error('Error seeding database:', error);
    process.exit(1);
  }
}

// Run seed function
seedCourses(); 
