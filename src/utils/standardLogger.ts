// src/utils/standardLogger.ts
/**
 * Standard logger implementation that enforces consistent log format
 */

import { getLogger } from './logging';
import { getCallerInfo } from './logContext';

/**
 * Create a standard logger for a module that enforces consistent log format
 *
 * @param moduleName Name of the module
 * @returns A logger with standardized methods
 */
export function createStandardLogger(moduleName: string) {
  const baseLogger = getLogger(moduleName);

  return {
    /**
     * Log at trace level with standard format
     *
     * @param context Object with context data
     * @param message Log message
     */
    trace: (context: Record<string, unknown> = {}, message: string): void => {
      const { file, method } = getCallerInfo();
      const sourceInfo = file && method ? `${file}:${method}` : file || 'unknown';
      baseLogger.trace(context, `[${sourceInfo}] ${message}`);
    },

    /**
     * Log at debug level with standard format
     *
     * @param context Object with context data
     * @param message Log message
     */
    debug: (context: Record<string, unknown> = {}, message: string): void => {
      const { file, method } = getCallerInfo();
      const sourceInfo = file && method ? `${file}:${method}` : file || 'unknown';
      baseLogger.debug(context, `[${sourceInfo}] ${message}`);
    },

    /**
     * Log at info level with standard format
     *
     * @param context Object with context data
     * @param message Log message
     */
    info: (context: Record<string, unknown> = {}, message: string): void => {
      const { file, method } = getCallerInfo();
      const sourceInfo = file && method ? `${file}:${method}` : file || 'unknown';
      baseLogger.info(context, `[${sourceInfo}] ${message}`);
    },

    /**
     * Log at warn level with standard format
     *
     * @param context Object with context data
     * @param message Log message
     */
    warn: (context: Record<string, unknown> = {}, message: string): void => {
      const { file, method } = getCallerInfo();
      const sourceInfo = file && method ? `${file}:${method}` : file || 'unknown';
      baseLogger.warn(context, `[${sourceInfo}] ${message}`);
    },

    /**
     * Log at error level with standard format
     *
     * @param error Error object
     * @param context Additional context
     * @param message Error message
     */
    error: (error: Error, context: Record<string, unknown> = {}, message: string): void => {
      const { file, method } = getCallerInfo();
      const sourceInfo = file && method ? `${file}:${method}` : file || 'unknown';
      baseLogger.error({ err: error, ...context }, `[${sourceInfo}] ${message}`);
    },
  };
}
