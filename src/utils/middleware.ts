import { FastifyRequest, FastifyReply } from 'fastify';
import { ObjectId } from 'mongodb';
import { AppError } from './errors';

// Authentication middleware - for now, just passes true
export async function authenticate(request: FastifyRequest, _reply: FastifyReply): Promise<void> {
  // For now, we'll skip actual authentication and just pass true
  request.user = { authenticated: true, id: 'dummy-user-id' };
  return;
}

// Validate MongoDB ObjectID
export function validateObjectId(id: string, paramName: string = 'id'): void {
  if (!ObjectId.isValid(id)) {
    throw new AppError(`Invalid ${paramName} format`, 400, 'INVALID_ID');
  }
}

// Course ID validator middleware
export function validateCourseId(
  request: FastifyRequest<{ Params: { courseId: string } }>,
  _reply: FastifyReply,
  done: () => void,
) {
  try {
    validateObjectId(request.params.courseId, 'courseId');
    done();
  } catch (error) {
    done(error as Error);
  }
}

// Module ID validator middleware
export function validateModuleId(
  request: FastifyRequest<{ Params: { moduleId: string } }>,
  _reply: FastifyReply,
  done: () => void,
) {
  try {
    validateObjectId(request.params.moduleId, 'moduleId');
    done();
  } catch (error) {
    done(error as Error);
  }
}

// Lesson ID validator middleware
export function validateLessonId(
  request: FastifyRequest<{ Params: { lessonId: string } }>,
  _reply: FastifyReply,
  done: () => void,
) {
  try {
    validateObjectId(request.params.lessonId, 'lessonId');
    done();
  } catch (error) {
    done(error as Error);
  }
}

// Helper to handle async route handlers and properly catch/forward errors
export function asyncHandler(
  handler: (request: FastifyRequest, _reply: FastifyReply) => Promise<any>,
) {
  return async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      return await handler(request, reply);
    } catch (error) {
      reply.log.error(error);
      // Let the global error handler deal with it
      throw error;
    }
  };
}

// Type augmentation for Fastify
declare module 'fastify' {
  interface FastifyRequest {
    user?: {
      authenticated: boolean;
      id: string;
    };
  }
}
