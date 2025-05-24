import { FastifySchema } from 'fastify';

// Course validation schemas
export const getCourseSchema: FastifySchema = {
  params: {
    type: 'object',
    required: ['courseId'],
    properties: {
      courseId: { type: 'string' },
    },
  },
};

export const createCourseSchema: FastifySchema = {
  body: {
    type: 'object',
    required: ['title', 'description', 'thumbnailUrl', 'instructor', 'category', 'difficulty'],
    properties: {
      title: { type: 'string' },
      description: { type: 'string' },
      thumbnailUrl: { type: 'string' },
      instructor: { type: 'string' },
      instructorAvatar: { type: 'string' },
      price: { type: 'string' },
      category: { type: 'string' },
      difficulty: { type: 'string' },
      featured: { type: 'boolean' },
      bestseller: { type: 'boolean' },
      newCourse: { type: 'boolean' },
      language: { type: 'string' },
    },
  },
};

export const updateCourseSchema: FastifySchema = {
  params: {
    type: 'object',
    required: ['courseId'],
    properties: {
      courseId: { type: 'string' },
    },
  },
  body: {
    type: 'object',
    properties: {
      title: { type: 'string' },
      description: { type: 'string' },
      thumbnailUrl: { type: 'string' },
      instructor: { type: 'string' },
      instructorAvatar: { type: 'string' },
      price: { type: 'string' },
      category: { type: 'string' },
      difficulty: { type: 'string' },
      featured: { type: 'boolean' },
      bestseller: { type: 'boolean' },
      newCourse: { type: 'boolean' },
      language: { type: 'string' },
    },
  },
};

// Module validation schemas
export const getModuleSchema: FastifySchema = {
  params: {
    type: 'object',
    required: ['courseId', 'moduleId'],
    properties: {
      courseId: { type: 'string' },
      moduleId: { type: 'string' },
    },
  },
};

export const createModuleSchema: FastifySchema = {
  params: {
    type: 'object',
    required: ['courseId'],
    properties: {
      courseId: { type: 'string' },
    },
  },
  body: {
    type: 'object',
    required: ['title', 'order'],
    properties: {
      title: { type: 'string' },
      order: { type: 'number' },
    },
  },
};

export const updateModuleSchema: FastifySchema = {
  params: {
    type: 'object',
    required: ['courseId', 'moduleId'],
    properties: {
      courseId: { type: 'string' },
      moduleId: { type: 'string' },
    },
  },
  body: {
    type: 'object',
    properties: {
      title: { type: 'string' },
      order: { type: 'number' },
    },
  },
};

// Lesson validation schemas
export const getLessonSchema: FastifySchema = {
  params: {
    type: 'object',
    required: ['courseId', 'moduleId', 'lessonId'],
    properties: {
      courseId: { type: 'string' },
      moduleId: { type: 'string' },
      lessonId: { type: 'string' },
    },
  },
};

export const createLessonSchema: FastifySchema = {
  params: {
    type: 'object',
    required: ['courseId', 'moduleId'],
    properties: {
      courseId: { type: 'string' },
      moduleId: { type: 'string' },
    },
  },
  body: {
    type: 'object',
    required: ['title', 'order'],
    properties: {
      title: { type: 'string' },
      videoUrl: { type: 'string' },
      content: { type: 'string' },
      duration: { type: 'string' },
      order: { type: 'number' },
    },
  },
};

export const updateLessonSchema: FastifySchema = {
  params: {
    type: 'object',
    required: ['courseId', 'moduleId', 'lessonId'],
    properties: {
      courseId: { type: 'string' },
      moduleId: { type: 'string' },
      lessonId: { type: 'string' },
    },
  },
  body: {
    type: 'object',
    properties: {
      title: { type: 'string' },
      videoUrl: { type: 'string' },
      content: { type: 'string' },
      duration: { type: 'string' },
      order: { type: 'number' },
    },
  },
};
