// This file is unused and its content has been commented out.
/*
// // src/modules/course/improved-video.route.ts
// import { FastifyInstance, FastifyPluginAsync } from 'fastify';
// import { ImprovedVideoStreamingController } from './improved-video.controller';

// /*
// // The improved video routes are currently unused and commented out for cleanup.
// const improvedVideoRoutes: FastifyPluginAsync = async (fastify: FastifyInstance): Promise<void> => {
//   // Initialize controller
//   const videoController = new ImprovedVideoStreamingController(fastify);

//   // Define authentication helper (optional - you can use your existing auth middleware)
//   const authenticate = async (request: any, reply: any) => {
//     try {
//       // If you have JWT authentication, uncomment this:
//       // await request.jwtVerify();

//       // For testing purposes, you can skip authentication:
//       request.user = {
//         id: 'test-user-id',
//       };
//       return;
//     } catch {
//       reply.code(401).send({ error: 'Unauthorized' });
//     }
//   };

//   // Register CORS pre-handler for all routes
//   // fastify.addHook('onRequest', (request, reply, done) => {
//   //   // Get the origin from the request headers
//   //   const origin = request.headers.origin || 'http://localhost:3030';

//   //   // Set specific origin instead of wildcard
//   //   reply.header('Access-Control-Allow-Origin', origin);
//   //   reply.header('Access-Control-Allow-Methods', 'GET, OPTIONS');
//   //   reply.header('Access-Control-Allow-Headers', 'Content-Type, Authorization');
//   //   reply.header('Access-Control-Allow-Credentials', 'true');

//   //   if (request.method === 'OPTIONS') {
//   //     reply.code(204).send();
//   //     return;
//   //   }
//   //   done();
//   // });

//   // ... (all route registrations would go here)
// };
// */

//   //   done();
//   // });

//   // Get master playlist (main .m3u8 file)
//   fastify.route({
//     method: 'GET',
//     url: '/api/videos/:lessonId/master.m3u8',
//     preValidation: authenticate,
//     handler: videoController.getMasterPlaylist.bind(videoController),
//   });

//   // Get variant playlist (quality-specific .m3u8 file)
//   fastify.route({
//     method: 'GET',
//     url: '/api/videos/:lessonId/:quality/playlist.m3u8',
//     preValidation: authenticate,
//     handler: videoController.getVariantPlaylist.bind(videoController),
//   });

//   // Fallback route for direct segment access (if needed)
//   fastify.route({
//     method: 'GET',
//     url: '/api/videos/:lessonId/:quality/:segment',
//     preValidation: authenticate,
//     handler: videoController.getDirectSegmentUrl.bind(videoController),
//     config: {
//       // Add a higher timeout for segment requests
//       timeout: 30000, // 30 seconds
//     },
//   });
// };

// export default improvedVideoRoutes;
*/
