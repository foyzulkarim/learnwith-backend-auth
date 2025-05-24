// // src/modules/course/video.controller.ts
// import { FastifyRequest, FastifyReply } from 'fastify';
// import { VideoStreamingService } from './video.service';
// import { ObjectId } from 'mongodb';
// import { LessonDocument } from './course.model';
// import { GetObjectCommand } from '@aws-sdk/client-s3';

// // Define request interfaces
// interface VideoStreamRequest extends FastifyRequest {
//   params: {
//     videoId: string;
//   };
//   // user: {
//   //   id: string;
//   // };
// }

// interface VideoSegmentRequest extends FastifyRequest {
//   params: {
//     videoId: string;
//     segmentPath: string;
//   };
//   // user: {
//   //   id: string;
//   // };
// }

// interface VariantPlaylistRequest extends FastifyRequest {
//   params: {
//     videoId: string;
//     quality: string;
//   };
//   // user: {
//   //   id: string;
//   // };
// }

// interface ProcessedVariantPlaylistRequest extends FastifyRequest {
//   params: {
//     videoId: string;
//     quality: string;
//   };
//   // user: {
//   //   id: string;
//   // };
// }

// interface SegmentFileRequest extends FastifyRequest {
//   params: {
//     videoId: string;
//     quality: string;
//     segment: string;
//   };
//   // user: {
//   //   id: string;
//   // };
// }

// interface ProcessedSegmentFileRequest extends FastifyRequest {
//   params: {
//     videoId: string;
//     quality: string;
//     segment: string;
//   };
//   // user: {
//   //   id: string;
//   // };
// }

// export class VideoStreamingController {
//   private videoStreamingService: VideoStreamingService;

//   constructor(fastify: any) {
//     this.videoStreamingService = new VideoStreamingService(fastify);
//   }

//   /**
//    * Method 1: Process m3u8 with signed URLs for segments
//    * This is the preferred method as it's more efficient
//    */
//   async getVideoStreamWithSignedUrls(
//     request: VideoStreamRequest,
//     reply: FastifyReply,
//   ): Promise<void> {
//     try {
//       const { videoId } = request.params;
//       // const userId = request.user.id;

//       // Validate videoId is a valid ObjectId
//       if (!ObjectId.isValid(videoId)) {
//         reply.code(400).send({ error: 'Invalid video ID format' });
//         return;
//       }

//       // 1. Check if the user has access to this video
//       //   const hasAccess = await this.videoStreamingService.checkUserAccess(userId, videoId);
//       //   if (!hasAccess) {
//       //     reply.code(403).send({ error: 'You do not have access to this video' });
//       //     return;
//       //   }
//       // const hasAccess = true; // For demo purposes, assume access is granted

//       // 2. Get video details
//       const video = await this.videoStreamingService.getVideoByLessonId(videoId);
//       if (!video) {
//         reply.code(404).send({ error: 'Video not found' });
//         return;
//       }

//       console.log('Video details:', video);

//       // 3. Process the m3u8 file with signed URLs
//       const processedM3u8 = await this.videoStreamingService.processM3u8WithSignedUrls(
//         video.videoUrl,
//         video._id.toString(),
//       );

//       // 4. Set proper content type and return the processed m3u8
//       reply
//         .header('Content-Type', 'application/vnd.apple.mpegurl')
//         .header('Cache-Control', 'private, max-age=3600')
//         .send(processedM3u8);
//     } catch (error) {
//       request.log.error(error);
//       reply.code(500).send({ error: 'Internal server error' });
//     }
//   }

//   async handleHlsRequest(
//     request: FastifyRequest<{
//       Querystring: {
//         videoId: string;
//         resolution?: string;
//         segment?: string;
//       };
//     }>,
//     reply: FastifyReply,
//   ): Promise<void> {
//     try {
//       const { videoId, resolution, segment } = request.query;

//       // Validate videoId is a valid ObjectId
//       if (!ObjectId.isValid(videoId)) {
//         reply.code(400).send({ error: 'Invalid video ID format' });
//         return;
//       }

//       // Perform access check
//       // const hasAccess = await this.videoStreamingService.checkUserAccess(request.user.id, videoId);
//       // const hasAccess = true; // For demo purposes, assume access is granted
//       if (!hasAccess) {
//         reply.code(403).send({ error: 'You do not have access to this video' });
//         return;
//       }

//       // Get video details
//       const video = await this.videoStreamingService.getVideoByLessonId(videoId);
//       if (!video) {
//         reply.code(404).send({ error: 'Video not found' });
//         return;
//       }

//       // Determine what type of request this is based on parameters
//       if (segment) {
//         // This is a segment request - generate pre-signed URL and redirect
//         return this.handleSegmentRequest(video, resolution!, segment, reply);
//       } else if (resolution) {
//         // This is a resolution-specific playlist request
//         return this.handleResolutionPlaylist(video, resolution, reply);
//       } else {
//         // This is a master playlist request
//         return this.handleMasterPlaylist(video, reply);
//       }
//     } catch (error) {
//       request.log.error(error);
//       reply.code(500).send({ error: 'Internal server error' });
//     }
//   }

//   // Handle master playlist request
//   private async handleMasterPlaylist(video: any, reply: FastifyReply): Promise<void> {
//     const processedM3u8 = await this.videoStreamingService.processM3u8WithSignedUrls(
//       video.videoUrl,
//       video._id.toString(),
//     );

//     reply
//       .header('Content-Type', 'application/vnd.apple.mpegurl')
//       .header('Cache-Control', 'private, max-age=3600')
//       .send(processedM3u8);
//   }

//   // Handle resolution-specific playlist request
//   private async handleResolutionPlaylist(
//     video: LessonDocument,
//     resolution: string,
//     reply: FastifyReply,
//   ): Promise<void> {
//     // Construct the path to the resolution-specific playlist
//     const basePath = video.videoUrl.substring(0, video.videoUrl.lastIndexOf('/') + 1);
//     const resolutionPlaylistPath = `${basePath}${resolution}/playlist.m3u8`;

//     console.log('handleResolutionPlaylist', { video });

//     // Process resolution playlist, rewriting segment URLs
//     const processedPlaylist = await this.videoStreamingService.processResolutionPlaylist(
//       resolutionPlaylistPath,
//       video._id.toString(),
//       resolution,
//     );

//     reply
//       .header('Content-Type', 'application/vnd.apple.mpegurl')
//       .header('Cache-Control', 'private, max-age=3600')
//       .send(processedPlaylist);
//   }

//   // Handle segment request
//   private async handleSegmentRequest(
//     video: LessonDocument,
//     resolution: string,
//     segment: string,
//     reply: FastifyReply,
//   ): Promise<void> {
//     try {
//       // Construct the path to the segment
//       const basePath = video.videoUrl.substring(0, video.videoUrl.lastIndexOf('/') + 1);
//       const segmentPath = `${basePath}${resolution}/${segment}`;
//       console.log('handleSegmentRequest', { video, basePath, resolution, segment, segmentPath });

//       // Instead of redirecting to a signed URL, fetch the segment directly from R2
//       const getCommand = new GetObjectCommand({
//         Bucket: this.videoStreamingService.getBucketName(),
//         Key: segmentPath,
//       });

//       const response = await this.videoStreamingService.getR2Client().send(getCommand);

//       if (!response.Body) {
//         throw new Error('Empty response body from R2');
//       }

//       // Set appropriate CORS headers to allow access from the frontend
//       reply
//         .header('Content-Type', response.ContentType || 'video/MP2T')
//         .header('Access-Control-Allow-Origin', '*')
//         .header('Access-Control-Allow-Methods', 'GET, OPTIONS')
//         .header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept')
//         .header('Cache-Control', 'public, max-age=3600')
//         .send(response.Body);
//     } catch (error) {
//       console.error('Error fetching segment:', error);
//       reply.code(500).send({ error: 'Error fetching video segment' });
//     }
//   }

//   /**
//    * Special handler for processed videos that doesn't validate videoId
//    */
//   async getProcessedVariantPlaylist(
//     request: ProcessedVariantPlaylistRequest,
//     reply: FastifyReply,
//   ): Promise<void> {
//     try {
//       const { videoId, quality } = request.params;

//       // 1. Build the base path for the variant playlist
//       // Use the videoId from the request params
//       const variantPath = `videos/${videoId}/${quality}/playlist.m3u8`;

//       // 2. Process the variant playlist without validating ObjectId
//       const processedVariant = await this.videoStreamingService.processProcessedVariantPlaylist(
//         variantPath,
//         quality,
//       );

//       // 3. Set proper content type and return the processed m3u8
//       reply
//         .header('Content-Type', 'application/vnd.apple.mpegurl')
//         .header('Cache-Control', 'private, max-age=3600')
//         .send(processedVariant);
//     } catch (error) {
//       request.log.error(error);
//       reply.code(500).send({ error: 'Internal server error' });
//     }
//   }

//   /**
//    * Get a variant playlist (quality-specific m3u8)
//    */
//   async getVariantPlaylist(request: VariantPlaylistRequest, reply: FastifyReply): Promise<void> {
//     try {
//       const { videoId, quality } = request.params;
//       // const userId = request.user.id;

//       // Validate videoId is a valid ObjectId
//       if (!ObjectId.isValid(videoId)) {
//         reply.code(400).send({ error: 'Invalid video ID format' });
//         return;
//       }

//       // 1. Check if the user has access to this video
//       // const hasAccess = true; // For demo purposes, assume access is granted

//       // 2. Get video details
//       const video = await this.videoStreamingService.getVideoByLessonId(videoId);
//       if (!video) {
//         reply.code(404).send({ error: 'Video not found' });
//         return;
//       }

//       // 3. Get the variant playlist path
//       const videoBasePath = video.videoUrl.substring(0, video.videoUrl.lastIndexOf('/') + 1);
//       const variantPath = `${videoBasePath}${quality}/playlist.m3u8`;

//       // 4. Process the variant playlist
//       const processedVariant = await this.videoStreamingService.processVariantPlaylist(
//         variantPath,
//         videoId,
//         quality,
//       );

//       // 5. Set proper content type and return the processed m3u8
//       reply
//         .header('Content-Type', 'application/vnd.apple.mpegurl')
//         .header('Cache-Control', 'private, max-age=3600')
//         .send(processedVariant);
//     } catch (error) {
//       request.log.error(error);
//       reply.code(500).send({ error: 'Internal server error' });
//     }
//   }

//   /**
//    * Get a segment file (.ts file)
//    */
//   async getSegmentFile(request: SegmentFileRequest, reply: FastifyReply): Promise<void> {
//     try {
//       const { videoId, quality, segment } = request.params;
//       // const userId = request.user.id;

//       // Validate videoId is a valid ObjectId
//       if (!ObjectId.isValid(videoId)) {
//         reply.code(400).send({ error: 'Invalid video ID format' });
//         return;
//       }

//       // Validate segment path for security
//       if (!segment || segment.includes('..') || !segment.endsWith('.ts')) {
//         reply.code(400).send({ error: 'Invalid segment path' });
//         return;
//       }

//       // 1. Get video details
//       const video = await this.videoStreamingService.getVideoByLessonId(videoId);
//       if (!video) {
//         reply.code(404).send({ error: 'Video not found' });
//         return;
//       }

//       // 2. Get the segment
//       const { body, contentType } = await this.videoStreamingService.getQualitySegment(
//         video.videoUrl,
//         quality,
//         segment,
//       );

//       // 3. Set proper content type and stream the segment
//       reply
//         .header('Content-Type', contentType)
//         .header('Cache-Control', 'private, max-age=86400') // Cache segments longer (24 hours)
//         .send(body);
//     } catch (error) {
//       request.log.error(error);
//       reply.code(500).send({ error: 'Internal server error' });
//     }
//   }

//   /**
//    * Method 2: Get m3u8 file modified to use our proxy for segments
//    * This gives more control but requires more server resources
//    */
//   async getVideoStreamWithProxy(request: VideoStreamRequest, reply: FastifyReply): Promise<void> {
//     try {
//       const { videoId } = request.params;
//       // const userId = request.user.id;

//       // Validate videoId is a valid ObjectId
//       if (!ObjectId.isValid(videoId)) {
//         reply.code(400).send({ error: 'Invalid video ID format' });
//         return;
//       }

//       // 1. Check if the user has access to this video
//       // const hasAccess = await this.videoStreamingService.checkUserAccess(userId, videoId);
//       // if (!hasAccess) {
//       //   reply.code(403).send({ error: 'You do not have access to this video' });
//       //   return;
//       // }

//       // 2. Get video details
//       const video = await this.videoStreamingService.getVideoById(videoId);
//       if (!video) {
//         reply.code(404).send({ error: 'Video not found' });
//         return;
//       }

//       // 3. Process the m3u8 file for proxy
//       const processedM3u8 = await this.videoStreamingService.processM3u8ForProxy(
//         video.hlsPath,
//         videoId,
//       );

//       // 4. Set proper content type and return the processed m3u8
//       reply
//         .header('Content-Type', 'application/vnd.apple.mpegurl')
//         .header('Cache-Control', 'private, max-age=3600')
//         .send(processedM3u8);
//     } catch (error) {
//       request.log.error(error);
//       reply.code(500).send({ error: 'Internal server error' });
//     }
//   }

//   /**
//    * Method 2 (continued): Get video segment through proxy
//    * This handles the segment requests from the modified m3u8
//    */
//   async getVideoSegment(request: VideoSegmentRequest, reply: FastifyReply): Promise<void> {
//     try {
//       const { videoId, segmentPath } = request.params;
//       // const userId = request.user.id;

//       // Validate videoId is a valid ObjectId
//       if (!ObjectId.isValid(videoId)) {
//         reply.code(400).send({ error: 'Invalid video ID format' });
//         return;
//       }

//       // Validate segmentPath for security
//       if (!segmentPath || segmentPath.includes('..') || !segmentPath.endsWith('.ts')) {
//         reply.code(400).send({ error: 'Invalid segment path' });
//         return;
//       }

//       // 1. Check if the user has access to this video
//       // const hasAccess = await this.videoStreamingService.checkUserAccess(userId, videoId);
//       // if (!hasAccess) {
//       //   reply.code(403).send({ error: 'You do not have access to this video' });
//       //   return;
//       // }

//       // 2. Get the segment from R2
//       const { body, contentType } = await this.videoStreamingService.getVideoSegment(
//         videoId,
//         segmentPath,
//       );

//       // 3. Set proper content type and stream the segment
//       reply
//         .header('Content-Type', contentType)
//         .header('Cache-Control', 'private, max-age=86400') // Cache segments longer (24 hours)
//         .send(body);
//     } catch (error) {
//       request.log.error(error);
//       reply.code(500).send({ error: 'Internal server error' });
//     }
//   }

//   /**
//    * Get a segment file for processed videos (no ObjectId validation)
//    */
//   async getProcessedSegmentFile(
//     request: ProcessedSegmentFileRequest,
//     reply: FastifyReply,
//   ): Promise<void> {
//     try {
//       const { videoId, quality, segment } = request.params;

//       // Validate segment path for security
//       if (!segment || segment.includes('..') || !segment.endsWith('.ts')) {
//         reply.code(400).send({ error: 'Invalid segment path' });
//         return;
//       }

//       // Get the segment using the updated method signature
//       const { body, contentType } = await this.videoStreamingService.getProcessedSegment(
//         videoId,
//         quality,
//         segment,
//       );

//       // Set proper content type and stream the segment
//       reply
//         .header('Content-Type', contentType)
//         .header('Cache-Control', 'private, max-age=86400') // Cache segments longer (24 hours)
//         .send(body);
//     } catch (error) {
//       request.log.error(error);
//       reply.code(500).send({ error: 'Internal server error' });
//     }
//   }
// }
