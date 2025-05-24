# Unused Code in the Codebase

This document identifies code that is not actively being used in the application but is being kept for reference or potential future use.

## Unused Files

The following files are not currently referenced or imported in the application and can be considered for removal in future cleanup:

1. `/workspaces/learnwith-backend/src/modules/course/video.route.ts` - Already commented out in app.ts
2. `/workspaces/learnwith-backend/src/modules/course/video.controller.ts` - Already commented out
3. `/workspaces/learnwith-backend/src/modules/course/video.service.ts` - Unused because video.route.ts is commented out
4. `/workspaces/learnwith-backend/src/modules/course/improved-video.route.ts` - Already commented out
5. `/workspaces/learnwith-backend/src/modules/course/improved-video.controller.ts` - Already commented out
6. `/workspaces/learnwith-backend/src/modules/course/direct-video.route.ts` - Not registered in app.ts
7. `/workspaces/learnwith-backend/src/modules/user/user.route.ts` - Empty file and not registered in app.ts

## Partially Used Files

These files contain some active code but also have unused functions:

1. `/workspaces/learnwith-backend/src/modules/course/improved-video.service.ts` - Only the `getSignedUrl` method is actively used by the HLS service

## Migration Strategy

When cleaning up these files:

1. First, ensure that the functionality provided by these files is truly not needed
2. If you want to preserve any logic for reference, consider moving key algorithms to a separate `/reference` folder
3. Delete the file after confirming it's safe to do so
4. Update any related imports or references

## Current Active Video Streaming Stack

The currently active video streaming implementation uses:
- `hls.route.ts` - Main routes for HLS video streaming
- `hls.service.ts` - Service to modify playlist content
- `improved-video.service.ts` (partially) - Only uses the `getSignedUrl` method
