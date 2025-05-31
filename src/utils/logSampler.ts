// src/utils/logSampler.ts
import { FastifyRequest } from 'fastify';
import { withLogglyTags } from './logglyHelper';

/**
 * Configuration for log sampling rates
 */
interface SamplingConfig {
  defaultRate: number; // Default sampling rate (e.g., 1.0 = 100%, 0.1 = 10%)
  routes: Record<string, number>; // Route-specific sampling rates
}

// Default sampling configuration
// Adjust these values based on your traffic patterns
const defaultConfig: SamplingConfig = {
  defaultRate: 1.0, // Log everything by default
  routes: {
    '/api/courses': 0.2, // Sample 20% of course listing requests
    '/api/hls': 0.05, // Sample only 5% of HLS video requests (high volume)
    '/api/auth/google': 1.0, // Always log all auth requests (low volume, high value)
  }
};

// In-memory cache of sampling decisions to maintain consistency for the same request path
const samplingDecisionCache: Record<string, boolean> = {};

/**
 * Determine if a log should be sampled based on route and sampling configuration
 * 
 * @param request The Fastify request object
 * @param config Optional sampling configuration
 * @returns Whether the log should be included in the sample
 */
export function shouldSampleLog(
  request: FastifyRequest,
  config: SamplingConfig = defaultConfig
): boolean {
  // In Fastify, we need to use the raw request URL since routerPath is not available on the type
  const path = request.url;
  
  // Check if we've already made a sampling decision for this path
  if (samplingDecisionCache[path] !== undefined) {
    return samplingDecisionCache[path];
  }
  
  // Find matching route with most specific match
  let samplingRate = config.defaultRate;
  let bestMatchLength = 0;
  
  Object.entries(config.routes).forEach(([routePath, rate]) => {
    if (path.startsWith(routePath) && routePath.length > bestMatchLength) {
      samplingRate = rate;
      bestMatchLength = routePath.length;
    }
  });
  
  // Make sampling decision
  const shouldSample = Math.random() < samplingRate;
  
  // Cache the decision for this path (to maintain consistency)
  // This cache could grow unbounded, so in production you might want to use a LRU cache
  samplingDecisionCache[path] = shouldSample;
  
  return shouldSample;
}

/**
 * Enhance a log object with sampling metadata
 * Call this before logging to add sampling information to logs
 * 
 * @param logObject The log object to enhance
 * @param isSampled Whether this log is included in the sample
 * @returns Enhanced log object with sampling metadata
 */
export function withSamplingInfo(
  logObject: Record<string, unknown>,
  isSampled: boolean
): Record<string, unknown> {
  return {
    ...logObject,
    _sampled: isSampled,
    ...withLogglyTags(isSampled ? ['sampled'] : ['sampled-out']),
  };
}

/**
 * Reset the sampling decision cache - mainly for testing purposes
 */
export function resetSamplingCache(): void {
  Object.keys(samplingDecisionCache).forEach(key => {
    delete samplingDecisionCache[key];
  });
}
