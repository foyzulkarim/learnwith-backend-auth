import { FastifyRequest, FastifyReply } from 'fastify';
import { ObjectId } from 'mongodb';
import { AppError } from './errors';

// Authentication middleware - for now, just passes true
export async function authenticate(request: FastifyRequest, _reply: FastifyReply): Promise<void> {
  // For now, we'll skip actual authentication and just pass true
  (request as any).user = { id: 'dummy-user-id', authenticated: true };
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
  request: FastifyRequest<{ Params: Record<string, string> }>,
  _reply: FastifyReply,
  done: (error?: Error) => void,
) {
  try {
    const params = request.params as { courseId: string };
    validateObjectId(params.courseId, 'courseId');
    done();
  } catch (error) {
    done(error as Error);
  }
}

// Module ID validator middleware
export function validateModuleId(
  request: FastifyRequest<{ Params: Record<string, string> }>,
  _reply: FastifyReply,
  done: (error?: Error) => void,
) {
  try {
    const params = request.params as { courseId: string; moduleId: string };
    validateObjectId(params.moduleId, 'moduleId');
    done();
  } catch (error) {
    done(error as Error);
  }
}

// Lesson ID validator middleware
export function validateLessonId(
  request: FastifyRequest<{ Params: Record<string, string> }>,
  _reply: FastifyReply,
  done: (error?: Error) => void,
) {
  try {
    const params = request.params as { courseId: string; moduleId: string; lessonId: string };
    validateObjectId(params.lessonId, 'lessonId');
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
import '@fastify/jwt';

declare module '@fastify/jwt' {
  interface UserJWTPayload {
    id: string;
    authenticated?: boolean;
    [key: string]: any; // Allow additional properties
  }
}
