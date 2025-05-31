# Loggly Integration Guide

This document outlines how to use the enhanced Loggly integration in the LearnWith backend.

## Setup

1. Obtain your Loggly customer token and subdomain from your Loggly account
2. Add the following environment variables:
   ```
   LOGGLY_TOKEN="your_loggly_customer_token"
   LOGGLY_SUBDOMAIN="your_subdomain"
   ```

## Features

### 1. Automatic Log Enrichment

All logs are automatically enriched with:

- Request ID
- User agent
- IP address
- URL
- Method
- Response time
- Status code

### 2. Log Sampling

High-volume routes are automatically sampled to avoid overwhelming Loggly with too many logs. Sampling rates can be adjusted in `/src/utils/logSampler.ts`:

```typescript
const defaultConfig: SamplingConfig = {
  defaultRate: 1.0, // Log everything by default
  routes: {
    '/api/courses': 0.2, // Sample 20% of course listing requests
    '/api/hls': 0.05, // Sample only 5% of HLS video requests (high volume)
    // Add more routes as needed
  }
};
```

### 3. Request Context Middleware

The `requestContextMiddleware` automatically adds context to all logs from a request, allowing you to trace the entire request flow in Loggly.

### 4. Health Check Endpoint

A dedicated health check endpoint is available at `/api/health/loggly` which:

- Confirms Loggly configuration status
- Sends a test log to Loggly
- Returns connection status

Example response:
```json
{
  "loggly": {
    "enabled": true,
    "subdomain": "mycompany",
    "tokenConfigured": true,
    "status": "connected_test_log_sent",
    "testId": "health-check-1234567890"
  }
}
```

### 5. User Context Helper

Use the `withUserContext` helper to add anonymized user information to logs:

```typescript
import { withUserContext } from '../utils/logglyHelper';

fastify.log.info(
  withUserContext(user._id), 
  'User logged in'
);
```

## Best Practices

1. **Use Structured Logging**: Always use objects for log context:
   ```typescript
   // GOOD
   fastify.log.info({ courseId, action: 'view' }, 'Course viewed');
   
   // AVOID
   fastify.log.info(`Course ${courseId} viewed`);
   ```

2. **Add Tags**: Use the `withLogglyTags` helper to add tags for filtering in Loggly:
   ```typescript
   import { withLogglyTags } from '../utils/logglyHelper';
   
   fastify.log.info(
     { ...withLogglyTags(['payment', 'success']) }, 
     'Payment processed'
   );
   ```

3. **Privacy**: Never log full sensitive information:
   ```typescript
   // GOOD
   log.info({ emailHash: hashForLogging(email) }, 'Email sent');
   
   // AVOID
   log.info({ email }, 'Email sent');
   ```

## Viewing Logs in Loggly

1. Log in to your Loggly account
2. Use the search feature to filter logs:
   - By tag: `tag:error`
   - By route: `json.url:"/api/courses"`
   - By status code: `json.statusCode:500`
   - By request ID: `json.requestId:"abc123"`

## Troubleshooting

If logs aren't appearing in Loggly:

1. Check your environment variables are set correctly
2. Verify your network allows outbound traffic to Loggly (port 443)
3. Use the `/api/health/loggly` endpoint to test connectivity
4. Check your Loggly account for any quota limits or issues
