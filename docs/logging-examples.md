# Logging Examples

This document provides examples of how to use the enhanced logging system with Loggly integration across different parts of the codebase.

> **Note:** For complete Loggly integration documentation, see [loggly-integration.md](./loggly-integration.md)

## Basic Logging

Logging works the same way it always has with Fastify - logs will automatically be sent to Loggly when configured with proper request context:

```typescript
// In route handlers
fastify.get('/', (request, reply) => {
  request.log.info('This log will be sent to Loggly if configured');
  // ...
});

// In services
class SomeService {
  constructor(private fastify: FastifyInstance) {}
  
  doSomething() {
    this.fastify.log.info('This log will be sent to Loggly if configured');
  }
}
```

## Adding Tags for Better Organization

You can add Loggly-specific tags to help organize logs:

```typescript
import { withLogglyTags } from '../utils/logglyHelper';

// In a controller or service
fastify.log.error(
  {
    err: error,
    userId: user.id,
    ...withLogglyTags(['auth', 'login-failure'])
  },
  'Authentication failed'
);
```

## Checking if Loggly is Enabled

You can conditionally run Loggly-specific code:

```typescript
import { isLogglyEnabled } from '../utils/logglyHelper';

if (isLogglyEnabled()) {
  // Do something Loggly-specific
  // For example, add extra context that only makes sense for Loggly
}
```

## New Features

### Request Context Enrichment

All logs are automatically enriched with request context:

```typescript
// Just log normally - context is added automatically
request.log.info('Processing request');

// Will include in Loggly:
// - requestId
// - url
// - method
// - IP address
// - user agent
```

### Log Sampling for High-Volume Routes

High-traffic routes are automatically sampled:

```typescript
// You don't need to change anything - sampling is automatic
// HLS video requests will be sampled at 5% to reduce log volume
// Authentication requests will always be logged (100%)
```

### User Context Helper

Use the `withUserContext` helper to safely include user info:

```typescript
import { withUserContext } from '../utils/logglyHelper';

fastify.log.info(
  withUserContext(user._id, { role: user.role }), 
  'User performed action'
);
```

## Best Practices

1. **Use Structured Logging**: Always pass an object as the first parameter containing relevant context:
   ```typescript
   // GOOD
   fastify.log.info({ userId, action: 'login', result: 'success' }, 'User logged in');
   
   // AVOID
   fastify.log.info(`User ${userId} logged in successfully`);
   ```

2. **Request IDs are Automatic**: Request IDs are now automatically included in all logs:
   ```typescript
   // No need to manually add requestId anymore
   fastify.log.info({ userId }, 'Processing request');
   ```

3. **Use Appropriate Log Levels**:
   - `debug`: Detailed information, typically only valuable during development
   - `info`: Confirmation that things are working as expected
   - `warn`: Warning conditions that should be addressed but don't affect functionality
   - `error`: Error conditions preventing normal operation
   - `fatal`: Critical errors causing application shutdown

4. **Add Tags for Important Events**: Use Loggly tags for events that need special attention:
   ```typescript
   fastify.log.warn(
     { 
       dbResponse,
       ...withLogglyTags(['database', 'performance'])
     }, 
     'Database query took more than 2 seconds'
   );
   ```

### Health Check Endpoint

Use the Loggly health check endpoint to verify connectivity:

```typescript
// Make a GET request to /api/health/loggly
// Response will show if Loggly is properly configured

const response = await fetch('/api/health/loggly');
const data = await response.json();
// {
//   "loggly": {
//     "enabled": true,
//     "subdomain": "mycompany",
//     "tokenConfigured": true,
//     "status": "connected_test_log_sent",
//     "testId": "health-check-1234567890"
//   }
// }
```

## Viewing Logs in Loggly

1. Log in to your Loggly dashboard at https://[your-subdomain].loggly.com/
2. Navigate to the Search view
3. Use the tag selector to filter by specific tags
4. Use the search bar to filter logs by content (e.g., `json.level:error`)
5. Click on any log entry to see its full details

### Useful Loggly Search Queries

- Find all errors: `json.level:error`
- Find logs for a specific request: `json.requestId:"abc123"`
- Find all logs with sampling applied: `tag:sampled`
- Find all health check logs: `tag:health-check`
- Find logs for a specific route: `json.url:"/api/auth/google"`
