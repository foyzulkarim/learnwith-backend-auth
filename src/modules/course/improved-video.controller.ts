// This file is unused and commented out for cleanup. Safe to delete if not needed.
// /*
// import {
//   Controller,
//   Get,
//   Post,
//   Put,
//   Delete,
//   Param,
//   Body,
//   Query,
//   HttpStatus,
//   Res,
//   Req,
// } from '@nestjs/common';
// import { Request, Response } from 'express';
// import { ImprovedVideoStreamingService } from './improved-video.service';
// interface VideoStreamRequest extends Request {
//   params: {
//     lessonId: string;
//   };
//   user?: {
//     id: string;
//   };
// }
// interface VariantPlaylistRequest extends Request {
//   params: {
//     lessonId: string;
//     quality: string;
//   };
//   user?: {
//     id: string;
//   };
// }
// class ImprovedVideoController {
//   constructor(
//     private readonly improvedVideoStreamingService: ImprovedVideoStreamingService,
//   ) {}

//   async getMasterPlaylist(request: VideoStreamRequest, reply: Response): Promise<void> {
//     try {
//       const processedM3u8 = await this.improvedVideoStreamingService.processMasterPlaylist(request.params.lessonId);
//       // Set CORS headers with specific origin for credentials to work
//       reply
//         .setHeader('Content-Type', 'application/vnd.apple.mpegurl')
//         .setHeader('Cache-Control', 'private, max-age=3600')
//         .setHeader('Access-Control-Allow-Origin', 'http://localhost:3030')
//         .setHeader('Access-Control-Allow-Credentials', 'true')
//         .send(processedM3u8);
//     } catch (error) {
//       request.log.error(`Error processing master playlist: ${error}`);
//       reply.status(HttpStatus.INTERNAL_SERVER_ERROR).json({ error: 'Internal server error' });
//     }
//   }
//   async getVariantPlaylist(request: VariantPlaylistRequest, reply: Response): Promise<void> {
//     try {
//       const { lessonId, quality } = request.params;

//       // Validate lessonId is a valid ObjectId
//       if (!request.params.lessonId) {
//         return reply.status(HttpStatus.BAD_REQUEST).json({ error: 'Invalid lesson ID format' });
//       }
//       // Skip authentication for now

//       // Process the variant playlist
//       const processedVariant = await this.improvedVideoStreamingService.processVariantPlaylist(
//         request.params.lessonId,
//         quality,
//       );

//       // Set CORS headers with specific origin for credentials to work
//       reply
//         .setHeader('Content-Type', 'application/vnd.apple.mpegurl')
//         .setHeader('Cache-Control', 'private, max-age=3600')
//         .setHeader('Access-Control-Allow-Origin', 'http://localhost:3030')
//         .setHeader('Access-Control-Allow-Credentials', 'true')
//         .send(processedVariant);
//     } catch (error) {
//       request.log.error(error);
//       reply.status(HttpStatus.INTERNAL_SERVER_ERROR).json({ error: 'Internal server error' });
//     }
//   }
//   async getDirectSegmentUrl(
//     request: Request<{
//       Params: {
//         lessonId: string;
//         quality: string;
//         segment: string;
//       };
//     }>,
//     reply: Response,
//   ): Promise<void> {
//     try {
//       const { lessonId, quality, segment } = request.params;

//       // Validate lessonId is a valid ObjectId
//       if (!request.params.lessonId) {
//         return reply.status(HttpStatus.BAD_REQUEST).json({ error: 'Invalid lesson ID format' });
//       }
//       // Validate segment path for security
//       if (!segment || segment.includes('..') || !segment.endsWith('.ts')) {
//         return reply.status(HttpStatus.BAD_REQUEST).json({ error: 'Invalid segment path' });
//       }
//       // Skip authentication for now

//       // Get the lesson to verify it exists
//       const lesson = await this.improvedVideoStreamingService.getLessonById(lessonId);
//       if (!lesson || !lesson.videoUrl) {
//         return reply.status(HttpStatus.NOT_FOUND).json({ error: 'Video not found' });
//       }
//       // Construct the path to the segment
//       const basePath = lesson.videoUrl.substring(0, lesson.videoUrl.lastIndexOf('/') + 1);
//       const segmentPath = `${basePath}${quality}/${segment}`;

//       // Get the segment file from S3
//       const { body, contentType } = await this.improvedVideoStreamingService.getSegmentFile(segmentPath);

//       // Handle client disconnection
//       request.on('close', () => {
//         if (body.destroy) {
//           body.destroy();
//         }
//       });
//       // Handle stream errors
//       body.on('error', (error) => {
//         request.log.error(`Stream error for segment ${segmentPath}: ${error}`);
//         if (!reply.writableEnded) {
//           reply.status(HttpStatus.INTERNAL_SERVER_ERROR).json({ error: 'Error streaming video segment' });
//         }
//       });
//       // Stream the segment file directly with specific origin for credentials to work
//       reply
//         .setHeader('Content-Type', contentType)
//         .setHeader('Access-Control-Allow-Origin', 'http://localhost:3030')
//         .setHeader('Access-Control-Allow-Credentials', 'true')
//         .setHeader('Cache-Control', 'public, max-age=86400') // Cache segments for 24 hours
//         .send(body);
//     } catch (error) {
//       request.log.error(error);
//       if (!reply.writableEnded) {
//         reply.status(HttpStatus.INTERNAL_SERVER_ERROR).json({ error: 'Internal server error' });
//       }
//     }
//   }
// }

// export const improvedVideoController = new ImprovedVideoController(
//   new ImprovedVideoStreamingService(),
// );
// */
