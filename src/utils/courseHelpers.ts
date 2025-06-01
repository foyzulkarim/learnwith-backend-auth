import { Logger } from './logger';

// Example utility functions that accept logger as parameter
export class CourseValidationHelpers {
  /**
   * Validates course data with logging
   * @param courseData - The course data to validate
   * @param logger - Logger instance passed from service
   * @returns validation result
   */
  static validateCourseData(
    courseData: any,
    logger: Logger,
  ): { isValid: boolean; errors: string[] } {
    logger.info(
      {
        operation: 'CourseValidationHelpers.validateCourseData',
        courseTitle: courseData.title,
        hasDescription: !!courseData.description,
        hasInstructor: !!courseData.instructor,
      },
      'Starting course data validation',
    );

    const errors: string[] = [];

    // Validation logic
    if (!courseData.title || courseData.title.trim().length < 3) {
      errors.push('Title must be at least 3 characters long');
    }

    if (!courseData.description || courseData.description.trim().length < 10) {
      errors.push('Description must be at least 10 characters long');
    }

    if (!courseData.instructor || courseData.instructor.trim().length < 2) {
      errors.push('Instructor name must be at least 2 characters long');
    }

    if (!courseData.category) {
      errors.push('Category is required');
    }

    if (
      !courseData.difficulty ||
      !['beginner', 'intermediate', 'advanced'].includes(courseData.difficulty)
    ) {
      errors.push('Difficulty must be one of: beginner, intermediate, advanced');
    }

    const isValid = errors.length === 0;

    if (isValid) {
      logger.info(
        {
          operation: 'CourseValidationHelpers.validateCourseData',
          success: true,
          courseTitle: courseData.title,
        },
        'Course data validation passed',
      );
    } else {
      logger.warn(
        {
          operation: 'CourseValidationHelpers.validateCourseData',
          success: false,
          errors,
          courseTitle: courseData.title,
        },
        `Course data validation failed: ${errors.join(', ')}`,
      );
    }

    return { isValid, errors };
  }

  /**
   * Sanitizes course data with logging
   * @param courseData - Raw course data
   * @param logger - Logger instance
   * @returns sanitized course data
   */
  static sanitizeCourseData(courseData: any, logger: Logger): any {
    const logContext = logger.startOperation('CourseValidationHelpers.sanitizeCourseData', {
      originalFields: Object.keys(courseData),
    });

    try {
      const sanitized = {
        ...courseData,
        title: courseData.title?.trim(),
        description: courseData.description?.trim(),
        instructor: courseData.instructor?.trim(),
        category: courseData.category?.toLowerCase(),
        difficulty: courseData.difficulty?.toLowerCase(),
        // Remove any potentially dangerous fields
        _id: undefined,
        __v: undefined,
      };

      // Remove undefined fields
      Object.keys(sanitized).forEach((key) => {
        if (sanitized[key] === undefined) {
          delete sanitized[key];
        }
      });

      logger.endOperation(logContext, 'Successfully sanitized course data', {
        sanitizedFields: Object.keys(sanitized),
        removedFields: Object.keys(courseData).filter((key) => !(key in sanitized)),
      });

      return sanitized;
    } catch (error) {
      logger.errorOperation(logContext, error, 'Failed to sanitize course data');
      throw error;
    }
  }

  /**
   * Business logic helper with comprehensive logging
   * @param courseId - Course ID
   * @param updateData - Data to update
   * @param logger - Logger instance
   * @returns processing result
   */
  static async processCourseUpdate(
    courseId: string,
    updateData: any,
    logger: Logger,
  ): Promise<{ success: boolean; message: string }> {
    const logContext = logger.startOperation('CourseValidationHelpers.processCourseUpdate', {
      courseId,
      updateFields: Object.keys(updateData),
    });

    try {
      // Simulate some business logic
      logger.debug(
        {
          operation: 'CourseValidationHelpers.processCourseUpdate',
          courseId,
          step: 'validation',
        },
        'Validating update data',
      );

      // Validate the update
      const validation = this.validateCourseData(updateData, logger);

      if (!validation.isValid) {
        logger.warn(
          {
            operation: 'CourseValidationHelpers.processCourseUpdate',
            courseId,
            validationErrors: validation.errors,
          },
          'Course update validation failed',
        );

        return { success: false, message: `Validation failed: ${validation.errors.join(', ')}` };
      }

      // Sanitize the data
      logger.debug(
        {
          operation: 'CourseValidationHelpers.processCourseUpdate',
          courseId,
          step: 'sanitization',
        },
        'Sanitizing update data',
      );

      const sanitizedData = this.sanitizeCourseData(updateData, logger);

      // Log business metrics
      logger.logMetric(
        'course_update_processed',
        {
          courseId,
          fieldsUpdated: Object.keys(sanitizedData).length,
          category: sanitizedData.category,
        },
        'Course update processing metric',
      );

      logger.endOperation(logContext, 'Successfully processed course update', {
        courseId,
        fieldsProcessed: Object.keys(sanitizedData),
      });

      return { success: true, message: 'Course update processed successfully' };
    } catch (error) {
      logger.errorOperation(logContext, error, `Failed to process course update for ${courseId}`);
      return { success: false, message: 'Internal processing error' };
    }
  }
}
