import { FastifyPluginAsync } from 'fastify';
import { getModifiedMasterPlaylist } from './hls.service';
import { CourseHelpers } from './course.model';
import { ImprovedVideoStreamingService } from './improved-video.service';
import { S3Client } from '@aws-sdk/client-s3';
import { GetObjectCommand } from '@aws-sdk/client-s3';
import { config } from '../../config';
import { withLogglyTags } from '../../utils/logglyHelper';

const HlsRoute: FastifyPluginAsync = async (fastify) => {
  fastify.get('/stream/:lessonId', async (request, reply) => {
    const { lessonId } = request.params as { lessonId: string };

    request.log.info(
      {
        lessonId,
        ...withLogglyTags(['hls', 'stream-request']),
      },
      'HLS master playlist request received',
    );

    try {
      const { content, contentType } = await getModifiedMasterPlaylist(lessonId);

      request.log.debug(
        {
          lessonId,
          contentType,
          contentLength: content.length,
          ...withLogglyTags(['hls', 'master-playlist-generated']),
        },
        'HLS master playlist generated successfully',
      );

      reply.header('Content-Type', contentType);
      reply.send(content);
    } catch (error) {
      request.log.error(
        {
          err: error,
          lessonId,
          ...withLogglyTags(['hls', 'stream-error']),
        },
        'Failed to generate HLS master playlist',
      );

      reply.status(500).send({ error: 'Internal Server Error' });
    }
  });

  fastify.get('/stream/playlist/:lessonId/:quality/playlist.m3u8', async (request, reply) => {
    const { lessonId, quality } = request.params as {
      lessonId: string;
      quality: string;
    };

    request.log.info(
      {
        lessonId,
        quality,
        ...withLogglyTags(['hls', 'quality-playlist-request']),
      },
      'HLS quality-specific playlist request received',
    );

    const videoStreamingService = new ImprovedVideoStreamingService(fastify);

    try {
      const lesson = await CourseHelpers.getLessonById(lessonId);
      if (!lesson) {
        request.log.warn(
          {
            lessonId,
            ...withLogglyTags(['hls', 'lesson-not-found']),
          },
          'Lesson not found for HLS playlist request',
        );

        throw new Error('Lesson not found');
      }

      const masterUrl = lesson.videoUrl;
      // remove the last part of the url which is master_playlist.m3u8
      const pathPrefix = masterUrl.split('/').slice(0, -1).join('/');
      // append quality to the path prefix
      const playlistKey = `${pathPrefix}/${quality}/playlist.m3u8`;

      request.log.debug(
        {
          lessonId,
          quality,
          playlistKey,
          ...withLogglyTags(['hls', 'playlist-key-generated']),
        },
        'Generated playlist key for R2 storage',
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

      request.log.debug(
        {
          bucket: config.R2_BUCKET_NAME,
          key: playlistKey,
          ...withLogglyTags(['hls', 'r2-request']),
        },
        'Requesting playlist from R2 storage',
      );

      const response = await s3.send(command);
      const body = await response.Body?.transformToString();

      if (!body) {
        request.log.error(
          {
            lessonId,
            quality,
            playlistKey,
            ...withLogglyTags(['hls', 'empty-response']),
          },
          'Empty response body from R2',
        );

        throw new Error('Empty response body from R2');
      }

      request.log.debug(
        {
          lessonId,
          quality,
          bodyLength: body.length,
          ...withLogglyTags(['hls', 'playlist-retrieved']),
        },
        'Retrieved playlist content from R2',
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

      // Join the resolved lines
      const modifiedContent = resolvedLines.join('\n');

      request.log.debug(
        {
          lessonId,
          quality,
          segmentCount: resolvedLines.filter((line) => line.includes('.ts')).length,
          ...withLogglyTags(['hls', 'signed-urls-generated']),
        },
        'Generated signed URLs for HLS segments',
      );

      reply.header('Content-Type', 'application/x-mpegURL');
      reply.send(modifiedContent);

      request.log.info(
        {
          lessonId,
          quality,
          ...withLogglyTags(['hls', 'playlist-served']),
        },
        'HLS playlist served successfully',
      );
    } catch (error) {
      request.log.error(
        {
          err: error,
          lessonId,
          quality,
          ...withLogglyTags(['hls', 'playlist-error']),
        },
        'Failed to serve HLS playlist',
      );

      reply.status(500).send({ error: 'Internal Server Error' });
    }
  });
};

export default HlsRoute;
