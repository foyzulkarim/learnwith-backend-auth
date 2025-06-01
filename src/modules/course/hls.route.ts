import { FastifyPluginAsync } from 'fastify';
import { getModifiedMasterPlaylist } from './hls.service';
import { CourseHelpers } from './course.model';
import { ImprovedVideoStreamingService } from './improved-video.service';
import { S3Client } from '@aws-sdk/client-s3';
import { GetObjectCommand } from '@aws-sdk/client-s3';
import { config } from '../../config';

const HlsRoute: FastifyPluginAsync = async (fastify) => {
  fastify.get('/stream/:lessonId', async (request, reply) => {
    const { lessonId } = request.params as { lessonId: string };

    try {
      const { content, contentType } = await getModifiedMasterPlaylist(lessonId);
      reply.header('Content-Type', contentType);
      reply.send(content);
    } catch (error) {
      console.error(error);
      reply.status(500).send({ error: 'Internal Server Error' });
    }
  });

  fastify.get('/stream/playlist/:lessonId/:quality/playlist.m3u8', async (request, reply) => {
    const { lessonId, quality } = request.params as {
      lessonId: string;
      quality: string;
    };

    const videoStreamingService = new ImprovedVideoStreamingService(fastify);

    try {
      const lesson = await CourseHelpers.getLessonById(lessonId);
      if (!lesson) throw new Error('Lesson not found');
      const masterUrl = lesson.videoUrl;
      // remove the last part of the url which is master_playlist.m3u8
      const pathPrefix = masterUrl.split('/').slice(0, -1).join('/');
      // append quality to the path prefix
      const playlistKey = `${pathPrefix}/${quality}/playlist.m3u8`;
      fastify.log.debug(
        {
          operation: 'hls_playlist_fetch',
          lessonId,
          quality,
        },
        'Fetching playlist from R2',
      );
      // using aws sdk get the playlist content
      const s3 = new S3Client({
        region: 'auto',
        endpoint: `https://${config.CLOUDFLARE_ACCOUNT_ID}.r2.cloudflarestorage.com`,
        credentials: {
          accessKeyId: config.R2_ACCESS_KEY_ID,
          secretAccessKey: config.R2_SECRET_ACCESS_KEY,
        },
      });
      const command = new GetObjectCommand({
        Bucket: config.R2_BUCKET_NAME,
        Key: playlistKey,
      });
      const response = await s3.send(command);
      const body = await response.Body?.transformToString();

      if (!body) {
        throw new Error('Empty response body from R2');
      }

      fastify.log.debug(
        {
          operation: 'hls_playlist_processing',
          lessonId,
          quality,
          lineCount: body.split('\n').length,
        },
        'Processing playlist content',
      );

      // Create an array of promises first, then await all of them
      const linePromises = body.split('\n').map(async (line) => {
        if (line.trim().endsWith('.ts')) {
          const segmentKey = `${pathPrefix}/${quality}/${line.trim()}`;
          const signedUrl = await videoStreamingService.getSignedUrl(segmentKey);
          return signedUrl;
        }
        return line;
      });

      // Wait for all promises to resolve
      const resolvedLines = await Promise.all(linePromises);

      fastify.log.debug(
        {
          operation: 'hls_playlist_complete',
          lessonId,
          quality,
          processedLines: resolvedLines.length,
        },
        'Playlist processing completed',
      );

      // Join the resolved lines
      const modifiedContent = resolvedLines.join('\n');

      reply.header('Content-Type', 'application/x-mpegURL');
      reply.send(modifiedContent);
    } catch (error) {
      fastify.log.error(
        {
          operation: 'hls_playlist_error',
          lessonId,
          quality,
          error: error instanceof Error ? error.message : 'Unknown error',
        },
        'Error fetching playlist',
      );
      reply.status(500).send({ error: 'Internal Server Error' });
    }
  });
};

export default HlsRoute;
