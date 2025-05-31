// src/utils/logContext.ts
/**
 * Utilities for capturing and including source code context in logs
 */

/**
 * Get the calling file and method information
 * This uses Error stack traces to determine where the log was called from
 *
 * @returns Object containing file and method information
 */
export function getCallerInfo(): { file?: string; method?: string } {
  try {
    // Create an error to capture the stack trace
    const err = new Error();
    const stack = err.stack || '';

    // Parse the stack trace to find the caller
    // Skip first two lines (Error and this function)
    const stackLines = stack.split('\n').slice(3);

    if (stackLines.length === 0) {
      return {};
    }

    // Extract file and method information from the stack trace
    const callerLine = stackLines[0].trim();

    // Different formats for different environments
    let match;

    // Format: "at MethodName (/path/to/file.js:line:column)"
    match = callerLine.match(/at\s+(.*)\s+\((.*):(\d+):(\d+)\)/);
    if (match) {
      const method = match[1];
      const file = match[2].split('/').pop() || '';
      return { file, method };
    }

    // Format: "at /path/to/file.js:line:column"
    match = callerLine.match(/at\s+(.*):(\d+):(\d+)/);
    if (match) {
      const file = match[1].split('/').pop() || '';
      return { file, method: '<anonymous>' };
    }

    // Format: "at new ClassName (/path/to/file.js:line:column)"
    match = callerLine.match(/at\s+new\s+(.*)\s+\((.*):(\d+):(\d+)\)/);
    if (match) {
      const method = `new ${match[1]}`;
      const file = match[2].split('/').pop() || '';
      return { file, method };
    }

    return {};
  } catch (error) {
    // If anything goes wrong, return empty context
    // eslint-disable-next-line no-console
    console.error('Error in getCallerInfo:', error);
    return {};
  }
}

/**
 * Create a log context object with source information
 *
 * @param additionalContext Additional context to include
 * @returns Log context with source information
 */
export function createLogContext(
  additionalContext: Record<string, unknown> = {},
): Record<string, unknown> {
  const { file, method } = getCallerInfo();

  return {
    ...additionalContext,
    source: file ? `${file}${method ? `:${method}` : ''}` : undefined,
  };
}
