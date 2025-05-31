import pino from 'pino';

// Determine the log level based on the environment
const level = process.env.NODE_ENV === 'production' ? 'info' : 'debug';

// Initialize base logger configuration
const loggerConfig: pino.LoggerOptions = {
  level,
  timestamp: pino.stdTimeFunctions.isoTime,
};

// Configure transport based on environment and available integrations
let transport: pino.TransportTargetOptions | undefined;

// Check if Loggly is configured
if (process.env.LOGGLY_TOKEN && process.env.LOGGLY_SUBDOMAIN) {
  // Use Loggly transport when token is provided (mainly for production)
  transport = {
    target: 'pino-loggly',
    options: {
      token: process.env.LOGGLY_TOKEN,
      subdomain: process.env.LOGGLY_SUBDOMAIN,
      tags: ['fastify', process.env.NODE_ENV || 'development'],
      timestamp: true
    }
  };
} else if (process.env.NODE_ENV !== 'production') {
  // Use pino-pretty transport for local development
  transport = { target: 'pino-pretty' };
}

// Add transport to logger config if defined
if (transport) {
  loggerConfig.transport = transport;
}

// Create a logger instance
export const logger = pino(loggerConfig);

export default logger;
