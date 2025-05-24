/**
 * Base class for all application errors
 */
export class AppError extends Error {
  statusCode: number;
  errorCode: string;
  isOperational: boolean;

  constructor(
    message: string,
    statusCode = 500,
    errorCode = 'INTERNAL_ERROR',
    isOperational = true,
  ) {
    super(message);
    this.statusCode = statusCode;
    this.errorCode = errorCode;
    this.isOperational = isOperational;

    // Maintains proper stack trace for where our error was thrown
    Error.captureStackTrace(this, this.constructor);

    // Set the prototype explicitly for better instanceof handling
    Object.setPrototypeOf(this, AppError.prototype);
  }
}

/**
 * Validation errors (400 Bad Request)
 */
export class ValidationError extends AppError {
  constructor(message: string, errorCode = 'VALIDATION_ERROR') {
    super(message, 400, errorCode, true);
    Object.setPrototypeOf(this, ValidationError.prototype);
  }
}

/**
 * Authentication errors (401 Unauthorized)
 */
export class AuthenticationError extends AppError {
  constructor(message: string, errorCode: string = 'UNAUTHORIZED', statusCode: number = 401) {
    super(message, statusCode, errorCode, true); // Order: message, statusCode, errorCode
    this.name = 'AuthenticationError';
    Object.setPrototypeOf(this, AuthenticationError.prototype);
  }
}

/**
 * Authorization errors (403 Forbidden)
 */
export class AuthorizationError extends AppError {
  constructor(message: string = 'You do not have permission to access this resource.', errorCode: string = 'FORBIDDEN', statusCode: number = 403) {
    super(message, statusCode, errorCode, true); // Order: message, statusCode, errorCode
    this.name = 'AuthorizationError';
    Object.setPrototypeOf(this, AuthorizationError.prototype);
  }
}

/**
 * Resource not found errors (404 Not Found)
 */
export class NotFoundError extends AppError {
  constructor(message: string, errorCode = 'NOT_FOUND_ERROR') {
    super(message, 404, errorCode, true);
    Object.setPrototypeOf(this, NotFoundError.prototype);
  }
}

/**
 * Conflict errors (409 Conflict) - for duplicate resources, etc.
 */
export class ConflictError extends AppError {
  constructor(message: string, errorCode = 'CONFLICT_ERROR') {
    super(message, 409, errorCode, true);
    Object.setPrototypeOf(this, ConflictError.prototype);
  }
}

/**
 * Service unavailable errors (503 Service Unavailable)
 */
export class ServiceUnavailableError extends AppError {
  constructor(message: string, errorCode = 'SERVICE_UNAVAILABLE') {
    super(message, 503, errorCode, true);
    Object.setPrototypeOf(this, ServiceUnavailableError.prototype);
  }
}

/**
 * Database errors
 */
export class DatabaseError extends AppError {
  constructor(message: string, errorCode = 'DATABASE_ERROR') {
    super(message, 500, errorCode, true);
    Object.setPrototypeOf(this, DatabaseError.prototype);
  }
}

/**
 * External service errors
 */
export class ExternalServiceError extends AppError {
  constructor(message: string, errorCode = 'EXTERNAL_SERVICE_ERROR') {
    super(message, 502, errorCode, true);
    Object.setPrototypeOf(this, ExternalServiceError.prototype);
  }
}

/**
 * Helper function to determine if an error is a known AppError
 */
export function isAppError(error: unknown): error is AppError {
  return error instanceof AppError;
}

/**
 * Helper function to convert unknown errors to AppError
 */
export function convertToAppError(error: unknown): AppError {
  if (isAppError(error)) {
    return error;
  }

  if (error instanceof Error) {
    return new AppError(error.message);
  }

  return new AppError(typeof error === 'string' ? error : 'An unknown error occurred');
}
