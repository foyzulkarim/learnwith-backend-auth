// src/modules/course/video.route.ts
import { FastifyInstance, FastifyPluginAsync, FastifyReply, FastifyRequest } from 'fastify';
import { VideoStreamingController } from './video.controller';

const videoRoutes: FastifyPluginAsync = async (fastify: FastifyInstance): Promise<void> => {
  // Initialize controller
  const videoController = new VideoStreamingController(fastify);

  // Define authentication helper
  const authenticate = async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      // await request.jwtVerify();
      // return truthy for demo purposes
      request.user = {
        id: 'userId', // Replace with actual user ID from JWT
        email: 'user@example.com', // Replace with actual user email from JWT
        role: 'student', // Replace with actual user role from JWT
      };
      return request;
    } catch {
      reply.code(401).send({ error: 'Unauthorized' });
    }
  };

  // Get video stream with signed URLs (HLS approach)
  fastify.route({
    method: 'GET',
    url: '/api/videos/:videoId/stream',
    preValidation: authenticate,
    handler: videoController.getVideoStreamWithSignedUrls.bind(videoController),
  });

  // Add new unified HLS route
  fastify.route({
    method: 'GET',
    url: '/api/hls',
    preValidation: authenticate,
    handler: videoController.handleHlsRequest.bind(videoController),
  });

  // Special route for processed videos - doesn't validate videoId as ObjectId
  fastify.route({
    method: 'GET',
    url: '/api/videos/processed/:videoId/:quality/playlist.m3u8',
    preValidation: authenticate,
    handler: videoController.getProcessedVariantPlaylist.bind(videoController),
  });

  // Special route for segment files of processed videos - doesn't validate videoId
  fastify.route({
    method: 'GET',
    url: '/api/videos/processed/:videoId/:quality/:segment',
    preValidation: authenticate,
    handler: videoController.getProcessedSegmentFile.bind(videoController),
  });

  // Handle variant playlist requests (quality-specific playlists)
  fastify.route({
    method: 'GET',
    url: '/api/videos/v1/:videoId/:quality/playlist.m3u8',
    preValidation: authenticate,
    handler: videoController.getVariantPlaylist.bind(videoController),
  });

  // Handle segment file requests (TS files)
  fastify.route({
    method: 'GET',
    url: '/api/videos/v1/:videoId/:quality/:segment',
    preValidation: authenticate,
    handler: videoController.getSegmentFile.bind(videoController),
  });

  // Alternative proxy approach
  // Get video stream manifest with proxy references
  fastify.route({
    method: 'GET',
    url: '/api/videos/v1/:videoId/proxy-stream',
    preValidation: authenticate,
    handler: videoController.getVideoStreamWithProxy.bind(videoController),
  });

  // Get video segment (for proxy approach)
  fastify.route({
    method: 'GET',
    url: '/api/videos/v1/:videoId/segments/:segmentPath',
    preValidation: authenticate,
    handler: videoController.getVideoSegment.bind(videoController),
  });
};

export default videoRoutes;
