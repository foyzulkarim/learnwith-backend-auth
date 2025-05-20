// src/modules/course/improved-video.controller.ts
import { FastifyRequest, FastifyReply } from 'fastify';
import { ImprovedVideoStreamingService } from './improved-video.service';
import { ObjectId } from 'mongodb';

// Define request interfaces
interface VideoStreamRequest extends FastifyRequest {
  params: {
    lessonId: string;
  };
  user?: {
    id: string;
  };
}

interface VariantPlaylistRequest extends FastifyRequest {
  params: {
    lessonId: string;
    quality: string;
  };
  user?: {
    id: string;
  };
}

export class ImprovedVideoStreamingController {
  private videoStreamingService: ImprovedVideoStreamingService;

  constructor(fastify: any) {
    this.videoStreamingService = new ImprovedVideoStreamingService(fastify);
  }

  /**
   * Get the master playlist for a video
   * This will return the master playlist with pre-signed URLs for variant playlists
   */
  async getMasterPlaylist(request: VideoStreamRequest, reply: FastifyReply): Promise<void> {
    try {
      const { lessonId } = request.params;
      // const userId = request.user?.id; // userId is currently unused

      request.log.info(`Received request for master playlist: ${lessonId}`);

      // Validate lessonId is a valid ObjectId
      if (!ObjectId.isValid(lessonId)) {
        reply.code(400).send({ error: 'Invalid lesson ID format' });
        return;
      }

      // For now, we're skipping authentication checks
      // Get the lesson to verify it exists
      const lesson = await this.videoStreamingService.getLessonById(lessonId);
      if (!lesson || !lesson.videoUrl) {
        reply.code(404).send({ error: 'Video not found' });
        return;
      }

      request.log.info(
        `Processing master playlist for lesson: ${lessonId}, videoUrl: ${lesson.videoUrl}`,
      );

      // Process the master playlist
      const processedM3u8 = await this.videoStreamingService.processMasterPlaylist(lessonId);

      // Set CORS headers with specific origin for credentials to work
      reply
        .header('Content-Type', 'application/vnd.apple.mpegurl')
        .header('Cache-Control', 'private, max-age=3600')
        .header('Access-Control-Allow-Origin', 'http://localhost:3030')
        .header('Access-Control-Allow-Credentials', 'true')
        .send(processedM3u8);
    } catch (error) {
      request.log.error(`Error processing master playlist: ${error}`);
      reply.code(500).send({ error: 'Internal server error' });
    }
  }

  /**
   * Get a variant playlist for a specific quality
   * This will return the variant playlist with pre-signed URLs for segments
   */
  async getVariantPlaylist(request: VariantPlaylistRequest, reply: FastifyReply): Promise<void> {
    try {
      const { lessonId, quality } = request.params;

      // Validate lessonId is a valid ObjectId
      if (!ObjectId.isValid(lessonId)) {
        reply.code(400).send({ error: 'Invalid lesson ID format' });
        return;
      }

      // Skip authentication for now

      // Process the variant playlist
      const processedVariant = await this.videoStreamingService.processVariantPlaylist(
        lessonId,
        quality,
      );

      // Set CORS headers with specific origin for credentials to work
      reply
        .header('Content-Type', 'application/vnd.apple.mpegurl')
        .header('Cache-Control', 'private, max-age=3600')
        .header('Access-Control-Allow-Origin', 'http://localhost:3030')
        .header('Access-Control-Allow-Credentials', 'true')
        .send(processedVariant);
    } catch (error) {
      request.log.error(error);
      reply.code(500).send({ error: 'Internal server error' });
    }
  }

  /**
   * Get a direct pre-signed URL for a specific segment
   * This is a fallback method in case you need to proxy segments through your server
   */
  async getDirectSegmentUrl(
    request: FastifyRequest<{
      Params: {
        lessonId: string;
        quality: string;
        segment: string;
      };
    }>,
    reply: FastifyReply,
  ): Promise<void> {
    try {
      const { lessonId, quality, segment } = request.params;

      // Validate lessonId is a valid ObjectId
      if (!ObjectId.isValid(lessonId)) {
        reply.code(400).send({ error: 'Invalid lesson ID format' });
        return;
      }

      // Validate segment path for security
      if (!segment || segment.includes('..') || !segment.endsWith('.ts')) {
        reply.code(400).send({ error: 'Invalid segment path' });
        return;
      }

      // Skip authentication for now

      // Get the lesson to verify it exists
      const lesson = await this.videoStreamingService.getLessonById(lessonId);
      if (!lesson || !lesson.videoUrl) {
        reply.code(404).send({ error: 'Video not found' });
        return;
      }

      // Construct the path to the segment
      const basePath = lesson.videoUrl.substring(0, lesson.videoUrl.lastIndexOf('/') + 1);
      const segmentPath = `${basePath}${quality}/${segment}`;

      // Get the segment file from S3
      const { body, contentType } = await this.videoStreamingService.getSegmentFile(segmentPath);

      // Handle client disconnection
      request.raw.on('close', () => {
        // Clean up the stream when client disconnects
        if (body.destroy) {
          body.destroy();
        }
      });

      // Handle stream errors
      body.on('error', (error) => {
        request.log.error(`Stream error for segment ${segmentPath}: ${error}`);
        if (!reply.sent) {
          reply.code(500).send({ error: 'Error streaming video segment' });
        }
      });

      // Stream the segment file directly with specific origin for credentials to work
      reply
        .header('Content-Type', contentType)
        .header('Access-Control-Allow-Origin', 'http://localhost:3030')
        .header('Access-Control-Allow-Credentials', 'true')
        .header('Cache-Control', 'public, max-age=86400') // Cache segments for 24 hours
        .send(body);
    } catch (error) {
      request.log.error(error);
      if (!reply.sent) {
        reply.code(500).send({ error: 'Internal server error' });
      }
    }
  }
}
