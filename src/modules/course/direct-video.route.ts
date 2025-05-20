// src/modules/course/direct-video.route.ts
import { FastifyInstance, FastifyPluginAsync, FastifyReply, FastifyRequest } from 'fastify';
import { ObjectId } from 'mongodb';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { GetObjectCommand, S3Client } from '@aws-sdk/client-s3';
import { CourseHelpers, LessonDocument } from './course.model';

// Simple controller for direct video access with SAS tokens
class DirectVideoController {
  private r2Client: S3Client;
  private bucketName: string;
  private signedUrlExpiration: number; // in seconds

  constructor(private fastify: FastifyInstance) {
    // Initialize the R2 client
    this.r2Client = new S3Client({
      region: 'auto',
      endpoint: `https://${process.env.CLOUDFLARE_ACCOUNT_ID}.r2.cloudflarestorage.com`,
      credentials: {
        accessKeyId: process.env.R2_ACCESS_KEY_ID || '',
        secretAccessKey: process.env.R2_SECRET_ACCESS_KEY || '',
      },
    });

    this.bucketName = process.env.R2_BUCKET_NAME || '';
    this.signedUrlExpiration = parseInt(process.env.SIGNED_URL_EXPIRATION || '3600', 10); // 1 hour default
  }

  // Get lesson by ID
  private async getLessonById(lessonId: string): Promise<LessonDocument | null> {
    try {
      return await CourseHelpers.getLessonById(lessonId);
    } catch (error) {
      this.fastify.log.error(`Error fetching lesson: ${error}`);
      return null;
    }
  }

  // Generate signed URL for an R2 object
  private async generateSignedUrl(
    objectKey: string,
    expiresIn: number = this.signedUrlExpiration,
  ): Promise<string> {
    try {
      const command = new GetObjectCommand({
        Bucket: this.bucketName,
        Key: objectKey,
      });

      return await getSignedUrl(this.r2Client, command, { expiresIn });
    } catch (error) {
      this.fastify.log.error(`Error generating signed URL: ${error}`);
      throw new Error(`Failed to generate signed URL: ${error}`);
    }
  }

  // Fetch text file from R2
  private async fetchTextFromR2(objectKey: string): Promise<string> {
    try {
      const command = new GetObjectCommand({
        Bucket: this.bucketName,
        Key: objectKey,
      });

      const response = await this.r2Client.send(command);

      if (!response.Body) {
        throw new Error('Empty response body from R2');
      }

      // Convert stream to string
      const streamToString = (stream: any): Promise<string> => {
        return new Promise((resolve, reject) => {
          const chunks: Buffer[] = [];
          stream.on('data', (chunk: Buffer) => chunks.push(chunk));
          stream.on('error', reject);
          stream.on('end', () => resolve(Buffer.concat(chunks).toString('utf-8')));
        });
      };

      return await streamToString(response.Body);
    } catch (error) {
      this.fastify.log.error(`Error fetching from R2: ${error}`);
      throw new Error(`Failed to fetch from R2: ${error}`);
    }
  }

  // Get master playlist with direct R2 signed URLs
  async getDirectMasterPlaylist(
    request: FastifyRequest<{ Params: { lessonId: string } }>,
    reply: FastifyReply,
  ) {
    try {
      const { lessonId } = request.params;

      // Validate lessonId
      if (!ObjectId.isValid(lessonId)) {
        return reply.code(400).send({ error: 'Invalid lesson ID format' });
      }

      // Get lesson
      const lesson = await this.getLessonById(lessonId);
      if (!lesson || !lesson.videoUrl) {
        return reply.code(404).send({ error: 'Lesson not found or has no video URL' });
      }

      // Extract the base path to the video files
      const basePath = lesson.videoUrl.substring(0, lesson.videoUrl.lastIndexOf('/') + 1);
      const masterPlaylistPath = `${basePath}master_playlist.m3u8`;

      console.log('Fetching master playlist from:', masterPlaylistPath);

      console.log(`Lesson details:`, {
        id: lesson._id,
        videoUrl: lesson.videoUrl,
        basePath,
        masterPlaylistPath,
      });

      // Get the master playlist content
      const masterPlaylist = await this.fetchTextFromR2(masterPlaylistPath);
      console.log('Master playlist content:', masterPlaylist.substring(0, 200) + '...');

      // Parse the master playlist to find the variant playlists
      const lines = masterPlaylist.split('\n');
      const modifiedLines: string[] = [];
      let isNextLineVariantPlaylist = false;

      for (const line of lines) {
        if (line.startsWith('#EXT-X-STREAM-INF')) {
          isNextLineVariantPlaylist = true;
          modifiedLines.push(line);
        } else if (isNextLineVariantPlaylist && line.trim() && !line.startsWith('#')) {
          isNextLineVariantPlaylist = false;

          // This is a variant playlist URL, generate a direct signed URL to R2 storage
          const variantPath = line.trim();
          const variantFullPath = `${basePath}${variantPath}`;
          const signedUrl = await this.generateSignedUrl(variantFullPath);

          console.log(`Replacing variant path "${variantPath}" with signed URL to R2 storage`);
          modifiedLines.push(signedUrl);
        } else {
          modifiedLines.push(line);
        }
      }

      // Send the modified master playlist
      reply
        .header('Content-Type', 'application/vnd.apple.mpegurl')
        .header('Access-Control-Allow-Origin', '*')
        .header('Cache-Control', 'public, max-age=3600')
        .send(modifiedLines.join('\n'));
    } catch (error) {
      request.log.error(`Error processing direct master playlist: ${error}`);
      reply.code(500).send({ error: 'Internal server error' });
    }
  }

  // Get a variant playlist with direct R2 signed URLs for segments
  async getDirectVariantPlaylist(
    request: FastifyRequest<{
      Params: {
        lessonId: string;
        variantPath: string;
      };
    }>,
    reply: FastifyReply,
  ) {
    try {
      const { lessonId, variantPath } = request.params;

      // Validate lessonId
      if (!ObjectId.isValid(lessonId)) {
        return reply.code(400).send({ error: 'Invalid lesson ID format' });
      }

      // Get lesson
      const lesson = await this.getLessonById(lessonId);
      if (!lesson || !lesson.videoUrl) {
        return reply.code(404).send({ error: 'Lesson not found or has no video URL' });
      }

      // Extract the base path to the video files
      const basePath = lesson.videoUrl.substring(0, lesson.videoUrl.lastIndexOf('/') + 1);
      const variantPlaylistPath = `${basePath}${variantPath}`;

      console.log('Fetching variant playlist from:', variantPlaylistPath);

      // Get the variant playlist content
      const variantPlaylist = await this.fetchTextFromR2(variantPlaylistPath);

      // Parse the variant playlist to replace segment URLs with signed URLs
      const lines = variantPlaylist.split('\n');
      const modifiedLines: string[] = [];

      for (const line of lines) {
        if (line.trim().endsWith('.ts') && !line.startsWith('#')) {
          // This is a segment file, generate a signed URL
          const segmentPath = `${basePath}${variantPath.split('/')[0]}/${line.trim()}`;
          const signedUrl = await this.generateSignedUrl(segmentPath);
          modifiedLines.push(signedUrl);
        } else {
          modifiedLines.push(line);
        }
      }

      // Send the modified variant playlist
      reply
        .header('Content-Type', 'application/vnd.apple.mpegurl')
        .header('Access-Control-Allow-Origin', '*')
        .header('Cache-Control', 'public, max-age=3600')
        .send(modifiedLines.join('\n'));
    } catch (error) {
      request.log.error(`Error processing direct variant playlist: ${error}`);
      reply.code(500).send({ error: 'Internal server error' });
    }
  }
}

// Define the plugin
const directVideoRoutes: FastifyPluginAsync = async (fastify: FastifyInstance): Promise<void> => {
  // Initialize controller
  const controller = new DirectVideoController(fastify);

  // Get master playlist with direct R2 signed URLs
  fastify.route({
    method: 'GET',
    url: '/api/direct-video/:lessonId/master',
    handler: controller.getDirectMasterPlaylist.bind(controller),
  });

  // Get variant playlist with direct R2 signed URLs for segments
  fastify.route({
    method: 'GET',
    url: '/api/direct-video/:lessonId/variant/:variantPath*',
    handler: controller.getDirectVariantPlaylist.bind(controller),
  });
};

export default directVideoRoutes;
