import pino from 'pino';

// Determine the log level based on the environment
const level = process.env.NODE_ENV === 'production' ? 'info' : 'debug';

// Create a logger instance
export const logger = pino({
  level,
  transport: process.env.NODE_ENV !== 'production' ? { target: 'pino-pretty' } : undefined,
  timestamp: pino.stdTimeFunctions.isoTime,
});

export default logger;
