# 📝 Comprehensive Logging Guide

This document covers everything you need to know about logging in this Fastify application, from basic configuration to advanced usage patterns.

## 📋 Table of Contents

1. [Configuration](#-configuration)
2. [Architecture Overview](#-architecture-overview)
3. [Request Tracing and Correlation IDs](#-request-tracing-and-correlation-ids)
4. [Usage Patterns](#-usage-patterns)
5. [Logger Utility](#-logger-utility)
6. [Best Practices](#-best-practices)
7. [Examples](#-examples)
8. [Troubleshooting](#-troubleshooting)

---

## 🔧 Configuration

### Environment Variables

Add these environment variables to your `.env` file:

```bash
# Logging Configuration
LOG_LEVEL=info                    # Options: trace, debug, info, warn, error, fatal
ENABLE_FILE_LOGGING=false         # Set to true to enable file-based logging
ENABLE_LOGGLY_LOGGING=false       # Set to true to enable Loggly cloud logging
LOG_FILE_PATH=./logs/app.log      # Optional: custom log file path
LOGGLY_TOKEN=your-token           # Required if ENABLE_LOGGLY_LOGGING=true
LOGGLY_SUBDOMAIN=your-subdomain   # Optional: Loggly subdomain
LOGGLY_TAGS=nodejs,fastify,backend # Optional: comma-separated tags
```

### Logging Modes

#### Development Mode (`NODE_ENV=development`)
- ✅ **Always enabled**: Pretty-printed console output with colors
- 🔧 **Optional**: File logging (if `ENABLE_FILE_LOGGING=true`)
- ☁️ **Optional**: Loggly logging (if `ENABLE_LOGGLY_LOGGING=true`)

#### Production Mode (`NODE_ENV=production`)
- ✅ **Always enabled**: JSON console output (for container logs)
- 🔧 **Optional**: File logging (if `ENABLE_FILE_LOGGING=true`)
- ☁️ **Optional**: Loggly logging (if `ENABLE_LOGGLY_LOGGING=true`)

### Common Configuration Examples

```bash
# Development with file logging
NODE_ENV=development
ENABLE_FILE_LOGGING=true
LOG_FILE_PATH=./logs/dev.log
LOG_LEVEL=debug

# Production with Loggly
NODE_ENV=production
ENABLE_LOGGLY_LOGGING=true
LOGGLY_TOKEN=your-production-token
LOG_LEVEL=info

# Production with both file and Loggly
NODE_ENV=production
ENABLE_FILE_LOGGING=true
ENABLE_LOGGLY_LOGGING=true
LOG_FILE_PATH=/var/log/app/production.log
LOGGLY_TOKEN=your-production-token
LOG_LEVEL=info
```

---

## 🏗️ Architecture Overview

The logging system is configured in `app.ts` and uses **Pino** as the underlying logger with multiple transports:

```
┌─────────────────┐
│      app.ts     │ ←── Configures Pino with multiple transports
└─────────────────┘
         ↓
┌─────────────────┐
│   Controllers   │ ←── Use request.log (has request context)
└─────────────────┘
         ↓
┌─────────────────┐
│    Services     │ ←── Use this.fastify.log or Logger utility
└─────────────────┘
         ↓
┌─────────────────┐
│   Utilities     │ ←── Receive logger as parameter
└─────────────────┘
```

### How Fastify Instance Flows Through Your App

**The Fastify instance is NOT magically available everywhere.** It flows through dependency injection:

```typescript
// app.ts → Creates Fastify instance
const fastify = Fastify({ logger: createLoggerConfig() });

// app.ts → Registers routes
fastify.register(courseRoutes, { prefix: '/api/courses' });

// course.route.ts → Receives Fastify instance
export default async function courseRoutes(fastify: FastifyInstance) {
  const courseService = new CourseService(fastify); // 🎯 Passed here
  // ...
}

// course.service.ts → Stores Fastify instance
export class CourseService {
  constructor(private fastify: FastifyInstance) { // 🎯 Received here
    // Now can use this.fastify.log
  }
}
```

---

## 🎯 Usage Patterns

### 1. In Controllers (Request Context Available)

```typescript
export class CourseController {
  getAllCoursesHandler = asyncHandler(
    async (request: FastifyRequest, reply: FastifyReply) => {
      const startTime = Date.now();
      const requestId = request.id;
      
      // ✅ Use request.log for automatic request correlation
      request.log.info({
        operation: 'getAllCourses',
        params: { page, limit },
        userId: (request as any).user?.id,
        requestId,
      }, 'Getting all courses');

      try {
        const result = await this.courseService.getAllCourses(page, limit);
        const duration = Date.now() - startTime;
        
        request.log.info({
          operation: 'getAllCourses',
          success: true,
          duration,
          resultCount: result.courses.length,
          requestId,
        }, `Successfully retrieved ${result.courses.length} courses in ${duration}ms`);

        return result;
      } catch (error) {
        request.log.error({
          operation: 'getAllCourses',
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error',
          requestId,
        }, 'Failed to retrieve courses');
        throw error;
      }
    }
  );
}
```

### 2. In Services (Using Fastify Logger Directly)

```typescript
export class CourseService {
  constructor(private fastify: FastifyInstance) {
    this.courseModel = getCourseModel();
  }

  async getAllCourses(page: number, limit: number) {
    const startTime = Date.now();
    
    // ✅ Use this.fastify.log
    this.fastify.log.info({
      operation: 'CourseService.getAllCourses',
      params: { page, limit },
    }, `Getting all courses with pagination`);

    try {
      const result = await this.courseModel.find().limit(limit);
      const duration = Date.now() - startTime;
      
      this.fastify.log.info({
        operation: 'CourseService.getAllCourses',
        success: true,
        duration,
        resultCount: result.length,
      }, `Retrieved ${result.length} courses in ${duration}ms`);
      
      return result;
    } catch (error) {
      this.fastify.log.error({
        operation: 'CourseService.getAllCourses',
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      }, 'Failed to retrieve courses');
      throw error;
    }
  }
}
```

### 3. Passing Request Context to Services

For better correlation between controller and service logs:

```typescript
// Controller
const result = await this.courseService.getAllCoursesWithContext(page, limit, {
  requestId: request.id,
  userId: (request as any).user?.id,
});

// Service
async getAllCoursesWithContext(
  page: number, 
  limit: number, 
  context: { requestId: string; userId?: string }
) {
  this.fastify.log.info({
    operation: 'CourseService.getAllCoursesWithContext',
    params: { page, limit },
    requestId: context.requestId, // 🎯 Request correlation
    userId: context.userId,
  }, `[${context.requestId}] Getting all courses`);
  // ...
}
```

---

## 🛠️ Logger Utility

For cleaner, more structured logging, we provide a `Logger` utility class that reduces boilerplate and provides consistent patterns.

### Setup

```typescript
import { createLogger, Logger } from '../../utils/logger';

export class CourseService {
  private logger: Logger;

  constructor(private fastify: FastifyInstance) {
    this.courseModel = getCourseModel();
    this.logger = createLogger(fastify); // 🎯 Create logger instance
  }
}
```

### Available Methods

```typescript
// Basic logging
this.logger.info(context, message)
this.logger.warn(context, message) 
this.logger.error(context, message)
this.logger.debug(context, message)

// Performance tracking
const logContext = this.logger.startOperation(operationName, context)
this.logger.endOperation(logContext, message?, additionalContext?)
this.logger.errorOperation(logContext, error, message?, additionalContext?)

// Business metrics
this.logger.logMetric(metricName, data, message?)
```

### Usage Pattern 1: Performance Tracking

**Perfect for database operations, API calls, or any operation you want to time:**

```typescript
async createCourse(courseData: CreateCoursePayload): Promise<Course> {
  // 🚀 Start operation with context - automatically tracks start time
  const logContext = this.logger.startOperation('CourseService.createCourse', {
    courseTitle: courseData.title,
    category: courseData.category,
  });

  try {
    const course = await this.courseModel.create(courseData);

    // ✅ Success - automatically logs duration and success context
    this.logger.endOperation(
      logContext, 
      `Successfully created course: ${course.title}`,
      { courseId: course._id }
    );

    return course;
  } catch (error) {
    // ❌ Error - automatically logs duration and error details
    this.logger.errorOperation(
      logContext, 
      error, 
      'Failed to create course in database'
    );
    throw error;
  }
}
```

**What this logs:**
```json
// Start
{"operation":"CourseService.createCourse","startTime":1703123456789,"courseTitle":"Advanced TypeScript","level":"info","msg":"Starting operation: CourseService.createCourse"}

// Success
{"operation":"CourseService.createCourse","duration":245,"success":true,"courseId":"abc123","level":"info","msg":"Successfully created course: Advanced TypeScript in 245ms"}
```

### Usage Pattern 2: Simple Logging

**For quick operations that don't need performance tracking:**

```typescript
async getModule(courseId: string, moduleId: string) {
  this.logger.info({
    operation: 'CourseService.getModule',
    courseId,
    moduleId,
  }, `Getting module: ${moduleId} from course: ${courseId}`);

  try {
    const module = await CourseHelpers.getModule(courseId, moduleId);
    
    if (!module) {
      this.logger.warn({
        operation: 'CourseService.getModule',
        courseId,
        moduleId,
        found: false,
      }, `Module not found: ${moduleId} in course: ${courseId}`);
      return null;
    }

    this.logger.info({
      operation: 'CourseService.getModule',
      courseId,
      moduleId,
      moduleTitle: module.title,
      found: true,
    }, `Successfully retrieved module: ${module.title}`);

    return module;
  } catch (error) {
    this.logger.error({
      operation: 'CourseService.getModule',
      courseId,
      moduleId,
      error: error instanceof Error ? error.message : 'Unknown error',
      errorType: error?.constructor?.name,
    }, `Failed to retrieve module: ${moduleId} from course: ${courseId}`);
    throw error;
  }
}
```

### Usage Pattern 3: Business Metrics

```typescript
// Track important business events
this.logger.logMetric('course_created', {
  courseId: course._id,
  category: course.category,
  difficulty: course.difficulty,
  instructor: course.instructor,
}, 'Course creation metric');

// This automatically adds:
// - operation: "metric:course_created"
// - metric: "course_created" 
// - timestamp: "2023-12-21T10:30:00.000Z"
```

### Usage Pattern 4: Utility Functions

**Pass logger to utility functions that don't have Fastify access:**

```typescript
// In utils/courseHelpers.ts
export class CourseValidationHelpers {
  static validateCourseData(courseData: any, logger: Logger): { isValid: boolean; errors: string[] } {
    logger.info({
      operation: 'CourseValidationHelpers.validateCourseData',
      courseTitle: courseData.title,
    }, 'Starting course data validation');

    const errors: string[] = [];
    // ... validation logic ...

    if (errors.length === 0) {
      logger.info({
        operation: 'CourseValidationHelpers.validateCourseData',
        success: true,
        courseTitle: courseData.title,
      }, 'Course data validation passed');
    } else {
      logger.warn({
        operation: 'CourseValidationHelpers.validateCourseData',
        success: false,
        errors,
      }, `Course data validation failed: ${errors.join(', ')}`);
    }

    return { isValid: errors.length === 0, errors };
  }

  static sanitizeCourseData(courseData: any, logger: Logger): any {
    // Using performance tracking in utility
    const logContext = logger.startOperation('CourseValidationHelpers.sanitizeCourseData', {
      originalFields: Object.keys(courseData),
    });

    try {
      const sanitized = {
        ...courseData,
        title: courseData.title?.trim(),
        description: courseData.description?.trim(),
        // ... sanitization logic
      };
      
      logger.endOperation(logContext, 'Successfully sanitized course data', {
        sanitizedFields: Object.keys(sanitized),
      });

      return sanitized;
    } catch (error) {
      logger.errorOperation(logContext, error, 'Failed to sanitize course data');
      throw error;
    }
  }
}
```

**Using utilities in service:**

```typescript
async createCourse(courseData: CreateCoursePayload): Promise<Course> {
  const logContext = this.logger.startOperation('CourseService.createCourse', {
    courseTitle: courseData.title,
  });

  try {
    // 🎯 Pass logger to utility functions
    const validation = CourseValidationHelpers.validateCourseData(courseData, this.logger);
    
    if (!validation.isValid) {
      throw new Error(`Validation failed: ${validation.errors.join(', ')}`);
    }

    // 🎯 Pass logger to another utility
    const sanitizedData = CourseValidationHelpers.sanitizeCourseData(courseData, this.logger);

    // ... rest of your logic
  } catch (error) {
    this.logger.errorOperation(logContext, error, 'Failed to create course');
    throw error;
  }
}
```

### Usage in Middleware

The Logger utility makes middleware logging easy:

```typescript
export const validateCourseMiddleware = async (request: FastifyRequest, reply: FastifyReply) => {
  const logger = createLogger(request.server);
  
  const validation = CourseValidationHelpers.validateCourseData(request.body, logger);
  
  if (!validation.isValid) {
    logger.warn({ 
      validationErrors: validation.errors,
      requestId: request.id 
    }, 'Middleware validation failed');
    return reply.status(400).send({ errors: validation.errors });
  }
};
```

---

## 📚 Best Practices

### 1. **Consistent Operation Naming**
Use the pattern `ServiceName.methodName` or `ClassName.methodName`:
```typescript
operation: 'CourseService.getAllCourses'
operation: 'CourseValidationHelpers.validateCourseData'
operation: 'AuthMiddleware.validateToken'
```

### 2. **Include Relevant Context**
Always include relevant business context:
```typescript
{
  operation: 'CourseService.createCourse',
  courseTitle: courseData.title,
  category: courseData.category,
  userId: context.userId,
  requestId: context.requestId,
}
```

### 3. **Use Request Correlation IDs**
Always include `requestId` when available for tracing requests across services:
```typescript
{
  operation: 'CourseService.getAllCourses',
  requestId: context.requestId, // Helps trace the request flow
  userId: context.userId,
}
```

### 4. **Performance Tracking for Important Operations**
Use the Logger utility's performance tracking for:
- Database operations
- External API calls
- File operations
- Complex business logic

### 5. **Business Metrics for Analytics**
Log important business events:
```typescript
this.logger.logMetric('course_created', { courseId, category });
this.logger.logMetric('user_enrolled', { userId, courseId });
this.logger.logMetric('payment_processed', { amount, currency });
```

### 6. **Appropriate Log Levels**
- **`error`**: Failures that need immediate attention
- **`warn`**: Important events (deletions, not found, business rule violations)
- **`info`**: Normal operation flow, business metrics, successful operations
- **`debug`**: Detailed information for debugging (use sparingly in production)

### 7. **Don't Log Sensitive Data**
Never log passwords, tokens, credit card numbers, or other sensitive information:
```typescript
// ❌ Bad
this.logger.info({ userPassword: user.password }, 'User login');

// ✅ Good
this.logger.info({ userId: user.id, email: user.email }, 'User login');
```

### 8. **Error Handling Patterns**
Always re-throw errors after logging to maintain error flow:
```typescript
try {
  // ... operation
} catch (error) {
  this.logger.errorOperation(logContext, error, 'Operation failed');
  throw error; // 🎯 Re-throw to maintain error handling flow
}
```

### 9. **Request Tracing Best Practices**

#### Always Use the Logger Utility in Services
The Logger utility automatically includes request IDs:
```typescript
// ✅ Good - Request ID automatically included
this.logger.info({
  operation: 'MyService.myMethod',
  userId: 'user123'
}, 'Processing user data');

// ❌ Avoid manual request ID passing
this.logger.info({
  operation: 'MyService.myMethod',
  requestId: someManuallyPassedId,
  userId: 'user123'
}, 'Processing user data');
```

#### Include Operation Names for Searchability
```typescript
// ✅ Good - Easy to search and filter
this.logger.info({
  operation: 'CourseService.getAllCourses',
  userId: 'user123'
}, 'Fetching courses');

// ❌ Hard to search
this.logger.info({
  userId: 'user123'
}, 'Fetching courses');
```

#### Use Consistent Field Names
```typescript
// ✅ Good - Consistent across all logs
{
  "requestId": "uuid-here",
  "operation": "ServiceName.methodName",
  "userId": "user123"
}

// ❌ Inconsistent field names
{
  "req_id": "uuid-here",      // Should be requestId
  "action": "method",         // Should be operation
  "user": "user123"          // Should be userId
}
```

---

## 💡 Examples

### Complete Service Method Example

```typescript
export class CourseService {
  private logger: Logger;

  constructor(private fastify: FastifyInstance) {
    this.courseModel = getCourseModel();
    this.logger = createLogger(fastify);
  }

  async createCourse(courseData: CreateCoursePayload, context?: { requestId?: string; userId?: string }): Promise<Course> {
    const logContext = this.logger.startOperation('CourseService.createCourse', {
      courseTitle: courseData.title,
      category: courseData.category,
      ...context,
    });

    try {
      // Validation with logging
      const validation = CourseValidationHelpers.validateCourseData(courseData, this.logger);
      
      if (!validation.isValid) {
        this.logger.warn({
          operation: 'CourseService.createCourse',
          validationErrors: validation.errors,
          ...context,
        }, 'Course creation validation failed');
        throw new Error(`Validation failed: ${validation.errors.join(', ')}`);
      }

      // Sanitization with logging
      const sanitizedData = CourseValidationHelpers.sanitizeCourseData(courseData, this.logger);

      // Database operation
      const course = await this.courseModel.create({
        ...sanitizedData,
        modules: [],
        totalLessons: 0,
        studentCount: 0,
      });

      // Transform result
      const transformedCourse = this.transformCourse(course);

      // Success logging
      this.logger.endOperation(
        logContext,
        `Successfully created course: ${transformedCourse.title}`,
        {
          courseId: transformedCourse._id,
          category: transformedCourse.category,
        }
      );

      // Business metrics
      this.logger.logMetric('course_created', {
        courseId: transformedCourse._id,
        category: transformedCourse.category,
        difficulty: transformedCourse.difficulty,
        instructor: transformedCourse.instructor,
      }, 'Course creation metric');

      return transformedCourse;
    } catch (error) {
      this.logger.errorOperation(
        logContext,
        error,
        'Failed to create course',
        {
          courseData: {
            title: courseData.title,
            category: courseData.category,
          },
        }
      );
      throw error;
    }
  }
}
```

### Controller with Service Integration

```typescript
export class CourseController {
  createCourseHandler = asyncHandler(
    async (request: FastifyRequest, reply: FastifyReply): Promise<Course> => {
      const startTime = Date.now();
      const courseData = request.body as CreateCoursePayload;
      const requestId = request.id;
      
      request.log.info({
        operation: 'createCourse',
        courseTitle: courseData.title,
        category: courseData.category,
        userId: (request as any).user?.id,
        requestId,
      }, `Creating new course: ${courseData.title}`);

      try {
        // Pass context to service for correlation
        const newCourse = await this.courseService.createCourse(courseData, {
          requestId,
          userId: (request as any).user?.id,
        });
        
        const duration = Date.now() - startTime;
        
        request.log.info({
          operation: 'createCourse',
          success: true,
          courseId: newCourse._id,
          courseTitle: newCourse.title,
          duration,
          requestId,
        }, `Successfully created course: ${newCourse.title} in ${duration}ms`);

        reply.code(201);
        return newCourse;
      } catch (error) {
        const duration = Date.now() - startTime;
        
        request.log.error({
          operation: 'createCourse',
          success: false,
          duration,
          error: error instanceof Error ? error.message : 'Unknown error',
          errorType: error?.constructor?.name,
          requestId,
        }, 'Failed to create course');
        
        throw error;
      }
    }
  );
}
```

---

## 🔧 Troubleshooting

### Common Issues

#### 1. **"fastify is not available" errors**
```typescript
// ❌ Wrong - fastify is not magically available
function someUtilityFunction() {
  fastify.log.info('This will not work');
}

// ✅ Correct - pass logger as parameter
function someUtilityFunction(data: any, logger: Logger) {
  logger.info({ operation: 'someUtilityFunction' }, 'This works');
}
```

#### 2. **Missing request correlation**
```typescript
// ❌ Missing correlation
this.fastify.log.info({ operation: 'serviceMethod' }, 'Message');

// ✅ With correlation
this.fastify.log.info({ 
  operation: 'serviceMethod',
  requestId: context.requestId 
}, 'Message');
```

#### 3. **Config file logging errors**
Config files load before Fastify is available, use console logging:
```typescript
// ❌ Wrong in config files
import { logger } from '../utils/logger';
logger.error('Config error');

// ✅ Correct in config files
console.error('Config error');
```

### Log Output Not Appearing

1. **Check LOG_LEVEL**: Make sure your log level allows the messages you're trying to log
2. **Check Environment**: Development vs production have different output formats
3. **Check Transport Configuration**: Verify file paths and Loggly credentials

### Performance Issues

1. **Avoid excessive debug logging** in production
2. **Use appropriate log levels** - debug logs can be expensive
3. **Don't log large objects** - log only relevant fields

---

## 🚀 Quick Reference

### Import Statements
```typescript
// For services
import { createLogger, Logger } from '../../utils/logger';

// For utilities
import { Logger } from '../../utils/logger';
```

### Basic Patterns
```typescript
// Simple logging
this.logger.info({ operation: 'methodName', context }, 'Message');

// Performance tracking
const logContext = this.logger.startOperation('methodName', context);
this.logger.endOperation(logContext, 'Success message', additionalContext);
this.logger.errorOperation(logContext, error, 'Error message');

// Business metrics
this.logger.logMetric('event_name', data, 'Description');
```

### Request Context Pattern
```typescript
// Controller
const context = { requestId: request.id, userId: user?.id };
const result = await this.service.method(data, context);

// Service
async method(data: any, context: { requestId: string; userId?: string }) {
  this.logger.info({
    operation: 'Service.method',
    requestId: context.requestId,
    userId: context.userId,
  }, 'Processing request');
}
```

This comprehensive logging system provides structured, traceable, and actionable logs that help with debugging, monitoring, and business analytics. The Logger utility reduces boilerplate while maintaining consistency across your application. 

---

## 🔍 Request Tracing and Correlation IDs

### Overview

The application uses proper UUID-based request IDs for comprehensive request tracing throughout the entire request lifecycle. This enables you to track a single request from entry to completion across all services and layers.

### Request ID Format

- **Before**: Simple incremental IDs like `req-a`, `req-5`
- **After**: Proper UUIDs like `2ad6001e-308f-467b-977a-d74b536dce77`

### Automatic Request ID Propagation

Request IDs are automatically included in:

1. **Fastify Request Logs**: All incoming requests and responses use `requestId`
2. **Service Layer Logs**: When using the Logger utility
3. **Controller Logs**: When using fastify.log or Logger utility  
4. **Error Logs**: All error logging includes the request ID

### Using Request IDs in Your Code

#### In Services (Automatic Propagation)

```typescript
import { createLogger } from '../utils/logger';

export class MyService {
  private logger = createLogger(this.fastify);

  async myMethod() {
    // Request ID is automatically included from request context
    this.logger.info({
      operation: 'MyService.myMethod',
      userId: 'user123'
    }, 'Processing user data');
    // Logs will include: "requestId": "2ad6001e-308f-467b-977a-d74b536dce77"
  }
}
```

#### Manual Request ID Access

```typescript
import { getCurrentRequestId } from '../utils/logger';

// Get current request ID from anywhere in the app
const requestId = getCurrentRequestId(fastify);
console.log('Current request:', requestId);
```

#### In Controllers

```typescript
async myController(request: FastifyRequest, reply: FastifyReply) {
  // Request ID is automatically included in fastify.log
  request.server.log.info({
    operation: 'controller.myMethod',
    userId: request.user.id
  }, 'Processing request');
  
  // Or access the request ID directly
  const requestId = request.id; // UUID string
}
```

### Log Output Examples

#### Before (Simple IDs with duplicates)
```json
{"reqId":"req-a","level":30,"msg":"incoming request"}
{"reqId":"req-5","requestId":"req-5","level":30,"msg":"service operation"}
```

#### After (UUID IDs with consistent field name)
```json
{
  "requestId":"2ad6001e-308f-467b-977a-d74b536dce77",
  "level":30,
  "msg":"incoming request"
}
{
  "requestId":"2ad6001e-308f-467b-977a-d74b536dce77",
  "level":30,
  "msg":"request completed"
}
{
  "requestId":"2ad6001e-308f-467b-977a-d74b536dce77",
  "operation":"MyService.myMethod",
  "level":30,
  "msg":"service operation"
}
```

### Benefits of Request Tracing

1. **Distributed Tracing**: Track requests across multiple services
2. **Debugging**: Easily find all logs related to a specific request
3. **Performance Monitoring**: Correlate performance metrics with specific requests
4. **Error Investigation**: Quickly trace errors back to the originating request
5. **Compliance**: Better audit trails for security and compliance requirements

### Searching Request Logs

To find all logs for a specific request:

```bash
# Search for a specific request ID
grep "2ad6001e-308f-467b-977a-d74b536dce77" logs/app.log

# Search with jq for JSON formatting
grep "2ad6001e-308f-467b-977a-d74b536dce77" logs/app.log | jq '.'

# Get request timeline
grep "2ad6001e-308f-467b-977a-d74b536dce77" logs/app.log | jq -r '[.time, .msg] | @csv'
```

---
