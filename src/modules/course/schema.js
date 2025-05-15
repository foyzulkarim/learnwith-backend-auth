import mongoose from 'mongoose';
const { Schema } = mongoose;

// Course Schema
const courseSchema = new Schema(
  {
    title: {
      type: String,
      required: true,
      trim: true,
    },
    description: {
      type: String,
      required: true,
    },
    thumbnail: {
      type: String,
      required: true,
    },
    instructor: {
      type: String,
      required: true,
    },
    instructorAvatar: {
      type: String,
    },
    categoryId: {
      type: Number,
    },
    bestseller: {
      type: Boolean,
      default: false,
    },
    featured: {
      type: Boolean,
      default: false,
    },
    isNew: {
      type: Boolean,
      default: false,
    },
    totalLessons: {
      type: Number,
      default: 0,
    },
    totalDuration: {
      type: String,
    },
    lastUpdated: {
      type: String,
    },
    language: {
      type: String,
      default: 'English',
    },
    captions: {
      type: [String],
    },
    studentCount: {
      type: Number,
      default: 0,
    },
    rating: {
      type: String,
    },
    isActive: {
      type: Boolean,
      default: true,
    },
    createdBy: {
      type: Schema.Types.ObjectId,
      ref: 'User',
    },
  },
  {
    timestamps: true,
  }
);

// Create the model
const Course = mongoose.model('Course', courseSchema);

export default Course; 
