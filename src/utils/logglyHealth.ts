// src/utils/logglyHealth.ts
import { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { isLogglyEnabled, withLogglyTags } from './logglyHelper';
import { logger } from './logger';

/**
 * Checks the health of the Loggly connection by sending a test log
 * and verifying configuration
 */
export async function checkLogglyHealth(
  _request: FastifyRequest,
  reply: FastifyReply
): Promise<void> {
  const isEnabled = isLogglyEnabled();
  
  // Define the health status with the correct interface
  interface LogglyHealthStatus {
    enabled: boolean;
    subdomain: string | null;
    tokenConfigured: boolean;
    status: string;
    testId?: string;
  }
  
  const healthStatus: { loggly: LogglyHealthStatus } = {
    loggly: {
      enabled: isEnabled,
      subdomain: isEnabled ? (process.env.LOGGLY_SUBDOMAIN || null) : null,
      tokenConfigured: !!process.env.LOGGLY_TOKEN,
      status: isEnabled ? 'connected' : 'disabled',
    }
  };
  
  // If Loggly is enabled, send a test log with a unique ID to verify connectivity
  if (isEnabled) {
    const testId = `health-check-${Date.now()}`;
    logger.info(
      { 
        ...withLogglyTags(['health-check', 'monitoring']),
        testId,
      },
      'Loggly health check initiated'
    );
    
    // Note: A true health check would verify the log was received by Loggly's API
    // but that would require making an API call to Loggly's search endpoint
    healthStatus.loggly.status = 'connected_test_log_sent';
    healthStatus.loggly.testId = testId;
  }
  
  reply.status(200).send(healthStatus);
}

/**
 * Register Loggly health check routes
 */
export function registerLogglyHealthRoutes(fastify: FastifyInstance): void {
  fastify.get('/api/health/loggly', checkLogglyHealth);
}
