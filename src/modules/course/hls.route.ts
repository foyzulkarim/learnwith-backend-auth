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
    request.log.info(`[HLS] Request for master playlist for lessonId: ${lessonId}`);

    try {
      const { content, contentType } = await getModifiedMasterPlaylist(lessonId);
      reply.header('Content-Type', contentType);
      reply.send(content);
      request.log.info(`[HLS] Successfully sent master playlist for lessonId: ${lessonId}`);
    } catch (error) {
      request.log.error({ err: error, lessonId }, '[HLS] Error processing master playlist request');
      reply.status(500).send({ error: 'Internal Server Error' });
    }
  });

  fastify.get('/stream/playlist/:lessonId/:quality/playlist.m3u8', async (request, reply) => {
    const { lessonId, quality } = request.params as {
      lessonId: string;
      quality: string;
    };
    request.log.info(`[HLS] Request for quality playlist for lessonId: ${lessonId}, quality: ${quality}`);

    const videoStreamingService = new ImprovedVideoStreamingService(fastify);

    try {
      const lesson = await CourseHelpers.getLessonById(lessonId);
      if (!lesson) {
        request.log.warn(`[HLS] Lesson not found for lessonId: ${lessonId} while fetching quality playlist.`);
        throw new Error('Lesson not found');
      }
      const masterUrl = lesson.videoUrl;
      // remove the last part of the url which is master_playlist.m3u8
      const pathPrefix = masterUrl.split('/').slice(0, -1).join('/');
      // append quality to the path prefix
      const playlistKey = `${pathPrefix}/${quality}/playlist.m3u8`;
      request.log.debug(`[HLS] Constructed playlist S3 key: ${playlistKey}`);

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
      request.log.info(`[HLS] Fetching playlist from R2: ${playlistKey}`);
      const response = await s3.send(command);
      const body = await response.Body?.transformToString();

      if (!body) {
        request.log.error(`[HLS] Empty response body from R2 for key: ${playlistKey}`);
        throw new Error('Empty response body from R2');
      }
      request.log.debug(`[HLS] Successfully fetched playlist from R2, length: ${body.length}`);

      // Create an array of promises first, then await all of them
      let segmentCount = 0;
      const linePromises = body.split('\n').map(async (line) => {
        if (line.trim().endsWith('.ts')) {
          segmentCount++;
          const segmentKey = `${pathPrefix}/${quality}/${line.trim()}`;
          // request.log.debug(`[HLS] Generating signed URL for segment: ${segmentKey}`);
          const signedUrl = await videoStreamingService.getSignedUrl(segmentKey);
          return signedUrl;
        }
        return line;
      });

      // Wait for all promises to resolve
      const resolvedLines = await Promise.all(linePromises);
      request.log.info(`[HLS] Generated signed URLs for ${segmentCount} segments.`);

      // Join the resolved lines
      const modifiedContent = resolvedLines.join('\n');

      reply.header('Content-Type', 'application/x-mpegURL');
      reply.send(modifiedContent);
      request.log.info(`[HLS] Successfully sent quality playlist for lessonId: ${lessonId}, quality: ${quality}`);
    } catch (error) {
      request.log.error({ err: error, lessonId, quality }, '[HLS] Error processing quality playlist request');
      reply.status(500).send({ error: 'Internal Server Error' });
    }
  });
};

export default HlsRoute;
