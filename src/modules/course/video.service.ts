// // src/modules/course/video.service.ts
// import { FastifyInstance } from 'fastify';
// import { S3Client, GetObjectCommand } from '@aws-sdk/client-s3';
// import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
// import { Readable } from 'stream';
// import { getVideoModel, VideoDocument } from './video.model';
// import { UserCourseHelpers } from './user-course.model';
// import { CourseHelpers, LessonDocument } from './course.model';

// export class VideoStreamingService {
//   private r2Client: S3Client;
//   private bucketName: string;
//   private signedUrlExpiration: number;

//   constructor(private fastify: FastifyInstance) {
//     // Initialize R2 client
//     this.r2Client = new S3Client({
//       region: 'auto',
//       endpoint: `https://${process.env.CLOUDFLARE_ACCOUNT_ID}.r2.cloudflarestorage.com`,
//       credentials: {
//         accessKeyId: process.env.R2_ACCESS_KEY_ID || '',
//         secretAccessKey: process.env.R2_SECRET_ACCESS_KEY || '',
//       },
//     });

//     this.bucketName = process.env.R2_BUCKET_NAME || '';
//     this.signedUrlExpiration = parseInt(process.env.SIGNED_URL_EXPIRATION || '3600', 10); // 1 hour default
//     console.log('R2 client initialized with bucket:');
//   }

//   /**
//    * Get the R2 client for direct operations
//    */
//   getR2Client(): S3Client {
//     return this.r2Client;
//   }

//   /**
//    * Get the bucket name
//    */
//   getBucketName(): string {
//     return this.bucketName;
//   }

//   /**
//    * Check if a user has access to a specific video
//    */
//   async checkUserAccess(userId: string, videoId: string): Promise<boolean> {
//     try {
//       // 1. Get the video details to find its course
//       const video = await this.getVideoById(videoId);
//       if (!video) {
//         return false;
//       }

//       // 2. Check if user is enrolled in the course
//       return await UserCourseHelpers.isUserEnrolled(userId, video.courseId.toString());
//     } catch (error) {
//       this.fastify.log.error(`Error checking user access: ${error}`);
//       return false;
//     }
//   }

//   /**
//    * Get a video document by ID
//    */
//   async getVideoById(videoId: string): Promise<VideoDocument | null> {
//     try {
//       const VideoModel = getVideoModel();
//       return await VideoModel.findById(videoId);
//     } catch (error) {
//       this.fastify.log.error(`Error fetching video: ${error}`);
//       return null;
//     }
//   }

//   async getVideoByLessonId(lessonId: string): Promise<LessonDocument | null> {
//     try {
//       const lesson = await CourseHelpers.getLessonById(lessonId);
//       if (!lesson) {
//         return null;
//       }
//       return lesson;
//     } catch (error) {
//       this.fastify.log.error(`Error fetching video by lesson ID: ${error}`);
//       return null;
//     }
//   }

//   /**
//    * Process an m3u8 file, replacing segment URLs with signed URLs
//    */
//   async processM3u8WithSignedUrls(m3u8Path: string, videoId: string): Promise<string> {
//     try {
//       // 1. Get the m3u8 file from R2
//       const getCommand = new GetObjectCommand({
//         Bucket: this.bucketName,
//         Key: m3u8Path,
//       });

//       const { Body } = await this.r2Client.send(getCommand);
//       if (!Body) {
//         throw new Error('Empty response body from R2');
//       }

//       const m3u8Content = await this.streamToString(Body as Readable);

//       // 2. Get the base path for segment files
//       const basePath = m3u8Path.substring(0, m3u8Path.lastIndexOf('/') + 1);

//       // 3. Check if this is a master playlist (contains EXT-X-STREAM-INF)
//       if (m3u8Content.includes('#EXT-X-STREAM-INF')) {
//         // This is a master playlist, we need to fix the variant playlist paths
//         return this.processMasterPlaylist(m3u8Content, basePath, m3u8Path, videoId);
//       }

//       // This is a variant playlist, process segment URLs
//       // 3. Parse and modify the m3u8 content to include signed URLs for segments
//       const lines = m3u8Content.split('\n');
//       const modifiedLines = await Promise.all(
//         lines.map(async (line) => {
//           // Check if the line is a segment file (typically ends with .ts)
//           if (line.trim().endsWith('.ts') || line.match(/\.ts\?/)) {
//             // Extract segment filename - handle absolute and relative paths
//             const segmentName = line.trim().split('/').pop()?.split('?')[0] || '';
//             const segmentPath = line.trim().startsWith('/')
//               ? line.trim().substring(1)
//               : basePath + segmentName;

//             // Generate signed URL for the segment
//             const segmentCommand = new GetObjectCommand({
//               Bucket: this.bucketName,
//               Key: segmentPath,
//             });

//             const signedUrl = await getSignedUrl(this.r2Client, segmentCommand, {
//               expiresIn: this.signedUrlExpiration,
//             });

//             // Replace the original segment path with the signed URL
//             return signedUrl;
//           }
//           return line;
//         }),
//       );

//       // 4. Join the modified lines back into a single string
//       return modifiedLines.join('\n');
//     } catch (error) {
//       this.fastify.log.error(`Failed to process m3u8 file: ${error}`);
//       throw new Error(`Failed to process m3u8 file: ${(error as Error).message}`);
//     }
//   }

//   // Also add a method for generating signed URLs
//   async getSignedUrl(objectPath: string): Promise<string> {
//     const command = new GetObjectCommand({
//       Bucket: this.bucketName,
//       Key: objectPath,
//     });

//     return getSignedUrl(this.r2Client, command, {
//       expiresIn: this.signedUrlExpiration,
//     });
//   }

//   /**
//    * Process a master playlist, adding absolute paths for variant playlists
//    */
//   private async processMasterPlaylist(
//     m3u8Content: string,
//     basePath: string,
//     m3u8Path: string,
//     videoId: string,
//   ): Promise<string> {
//     const lines = m3u8Content.split('\n');
//     // const videoId = m3u8Path.split('/').slice(-3)[0]; // Extract videoId from path

//     // We'll use query parameters approach for cleaner URLs
//     let isNextLineVariantPlaylist = false;

//     const modifiedLines = lines.map((line) => {
//       // Check for stream info tag
//       if (line.includes('#EXT-X-STREAM-INF')) {
//         isNextLineVariantPlaylist = true;
//         return line;
//       }

//       // Check if this line is a variant playlist URL (after a stream info tag)
//       if (isNextLineVariantPlaylist && line.trim() && !line.startsWith('#')) {
//         isNextLineVariantPlaylist = false;

//         // Extract resolution from the line (e.g., "360/playlist.m3u8" -> "360")
//         const resolution = line.trim().split('/')[0];

//         // Create a URL with query parameters that will identify:
//         // 1. The video ID
//         // 2. The resolution
//         // This will allow your API to know exactly what to serve
//         const apiBase = process.env.API_BASE_URL || 'http://localhost:4000';
//         const playlistUrl = `${apiBase}/api/hls?videoId=${videoId}&resolution=${resolution}`;

//         console.log(`Replacing variant playlist path: ${line.trim()} with ${playlistUrl}`);
//         return playlistUrl;
//       }

//       isNextLineVariantPlaylist = false;
//       return line;
//     });

//     return modifiedLines.join('\n');
//   }

//   /**
//    * Process a variant playlist (quality-specific m3u8 file)
//    */
//   async processVariantPlaylist(
//     variantPath: string,
//     videoId: string,
//     quality: string,
//   ): Promise<string> {
//     try {
//       // 1. Get the variant playlist file from R2
//       const getCommand = new GetObjectCommand({
//         Bucket: this.bucketName,
//         Key: variantPath,
//       });

//       const { Body } = await this.r2Client.send(getCommand);
//       if (!Body) {
//         throw new Error('Empty response body from R2');
//       }

//       const m3u8Content = await this.streamToString(Body as Readable);

//       // 2. Parse and modify the content to use absolute URLs for TS segments
//       const lines = m3u8Content.split('\n');
//       const qualityBasePath = variantPath.substring(0, variantPath.lastIndexOf('/') + 1);
//       console.log(`Quality base path: ${qualityBasePath}`);

//       const apiBase = process.env.API_BASE_URL || 'http://localhost:4000';

//       const modifiedLines = lines.map((line) => {
//         // Check if the line is a segment file (typically ends with .ts)
//         if (line.trim().endsWith('.ts') || line.match(/\.ts\?/)) {
//           // Replace with absolute URL to our API
//           const segmentName = line.trim();
//           // Ensure we have a clean segment name without any path
//           const cleanSegmentName = segmentName.split('/').pop() || segmentName;
//           return `${apiBase}/api/videos/${videoId}/${quality}/${cleanSegmentName}`;
//         }
//         return line;
//       });

//       // 3. Join the modified lines back into a single string
//       return modifiedLines.join('\n');
//     } catch (error) {
//       this.fastify.log.error(`Failed to process variant playlist: ${error}`);
//       throw new Error(`Failed to process variant playlist: ${(error as Error).message}`);
//     }
//   }

//   /**
//    * Process a variant playlist for processed videos (no ObjectId validation)
//    */
//   async processProcessedVariantPlaylist(variantPath: string, quality: string): Promise<string> {
//     try {
//       // 1. Get the variant playlist file from R2
//       const getCommand = new GetObjectCommand({
//         Bucket: this.bucketName,
//         Key: variantPath,
//       });

//       const { Body } = await this.r2Client.send(getCommand);
//       if (!Body) {
//         throw new Error('Empty response body from R2');
//       }

//       const m3u8Content = await this.streamToString(Body as Readable);

//       // 2. Extract videoId from the path
//       const videoId = variantPath.split('/').slice(-3)[0]; // Extract videoId from path

//       // 3. Parse and modify the content to use absolute URLs for TS segments
//       const lines = m3u8Content.split('\n');
//       const qualityBasePath = variantPath.substring(0, variantPath.lastIndexOf('/') + 1);
//       console.log(`Quality base path: ${qualityBasePath}`);

//       const apiBase = process.env.API_BASE_URL || 'http://localhost:4000';

//       const modifiedLines = lines.map((line) => {
//         // Check if the line is a segment file (typically ends with .ts)
//         if (line.trim().endsWith('.ts') || line.match(/\.ts\?/)) {
//           // Replace with absolute URL to our API
//           const segmentName = line.trim();
//           return `${apiBase}/api/videos/processed/${videoId}/${quality}/${segmentName}`;
//         }
//         return line;
//       });

//       // 4. Join the modified lines back into a single string
//       return modifiedLines.join('\n');
//     } catch (error) {
//       this.fastify.log.error(`Failed to process processed variant playlist: ${error}`);
//       throw new Error(`Failed to process processed variant playlist: ${(error as Error).message}`);
//     }
//   }

//   /**
//    * Get a segment file for a specific quality
//    */
//   async getQualitySegment(
//     masterPath: string,
//     quality: string,
//     segment: string,
//   ): Promise<{ body: Readable; contentType: string }> {
//     try {
//       // 1. Determine the base path from the master playlist
//       const basePath = masterPath.substring(0, masterPath.lastIndexOf('/') + 1);

//       // 2. Calculate the full segment path
//       const fullSegmentPath = `${basePath}${quality}/${segment}`;

//       // 3. Get the segment from R2
//       const getCommand = new GetObjectCommand({
//         Bucket: this.bucketName,
//         Key: fullSegmentPath,
//       });

//       const { Body, ContentType } = await this.r2Client.send(getCommand);

//       if (!Body) {
//         throw new Error('Empty response body from R2');
//       }

//       return {
//         body: Body as Readable,
//         contentType: ContentType || 'video/MP2T',
//       };
//     } catch (error) {
//       this.fastify.log.error(`Failed to get quality segment: ${error}`);
//       throw new Error(`Failed to get quality segment: ${(error as Error).message}`);
//     }
//   }

//   /**
//    * Process an m3u8 file for proxy approach
//    */
//   async processM3u8ForProxy(m3u8Path: string, videoId: string): Promise<string> {
//     try {
//       // 1. Get the m3u8 file from R2
//       const getCommand = new GetObjectCommand({
//         Bucket: this.bucketName,
//         Key: m3u8Path,
//       });

//       const { Body } = await this.r2Client.send(getCommand);
//       if (!Body) {
//         throw new Error('Empty response body from R2');
//       }

//       const m3u8Content = await this.streamToString(Body as Readable);

//       // 2. Parse and modify the m3u8 content to use proxy URLs for segments
//       const lines = m3u8Content.split('\n');
//       const modifiedLines = lines.map((line) => {
//         // Check if the line is a segment file (typically ends with .ts)
//         if (line.trim().endsWith('.ts') || line.match(/\.ts\?/)) {
//           // Extract segment name
//           const segmentName = line.trim().split('/').pop()?.split('?')[0] || '';

//           // Replace with proxy URL to our API
//           return `/api/videos/${videoId}/segments/${segmentName}`;
//         }
//         return line;
//       });

//       // 3. Join the modified lines back into a single string
//       return modifiedLines.join('\n');
//     } catch (error) {
//       this.fastify.log.error(`Failed to process m3u8 file: ${error}`);
//       throw new Error(`Failed to process m3u8 file: ${(error as Error).message}`);
//     }
//   }

//   /**
//    * Get a video segment from R2
//    */
//   async getVideoSegment(
//     videoId: string,
//     segmentPath: string,
//   ): Promise<{ body: Readable; contentType: string }> {
//     try {
//       // 1. Get video details to find base path
//       const video = await this.getVideoById(videoId);

//       if (!video) {
//         throw new Error('Video not found');
//       }

//       // 2. Determine the full path of the segment in R2
//       const basePath = video.hlsPath.substring(0, video.hlsPath.lastIndexOf('/') + 1);
//       const fullSegmentPath = basePath + segmentPath;

//       // 3. Get the segment from R2
//       const getCommand = new GetObjectCommand({
//         Bucket: this.bucketName,
//         Key: fullSegmentPath,
//       });

//       const { Body, ContentType } = await this.r2Client.send(getCommand);

//       if (!Body) {
//         throw new Error('Empty response body from R2');
//       }

//       return {
//         body: Body as Readable,
//         contentType: ContentType || 'video/MP2T',
//       };
//     } catch (error) {
//       this.fastify.log.error(`Failed to get video segment: ${error}`);
//       throw new Error(`Failed to get video segment: ${(error as Error).message}`);
//     }
//   }

//   /**
//    * Get a segment file for processed videos (without requiring video lookup)
//    */
//   async getProcessedSegment(
//     videoId: string,
//     quality: string,
//     segmentName: string,
//   ): Promise<{ body: Readable; contentType: string }> {
//     try {
//       // Construct the full path to the segment in R2
//       const segmentPath = `videos/${videoId}/${quality}/${segmentName}`;

//       // Get the segment directly from R2 using the constructed path
//       const getCommand = new GetObjectCommand({
//         Bucket: this.bucketName,
//         Key: segmentPath,
//       });

//       const { Body, ContentType } = await this.r2Client.send(getCommand);

//       if (!Body) {
//         throw new Error('Empty response body from R2');
//       }

//       return {
//         body: Body as Readable,
//         contentType: ContentType || 'video/MP2T',
//       };
//     } catch (error) {
//       this.fastify.log.error(`Failed to get processed segment: ${error}`);
//       throw new Error(`Failed to get processed segment: ${(error as Error).message}`);
//     }
//   }

//   // Helper function to convert readable stream to string
//   private streamToString(stream: Readable): Promise<string> {
//     return new Promise((resolve, reject) => {
//       const chunks: Buffer[] = [];
//       stream.on('data', (chunk) => chunks.push(Buffer.from(chunk)));
//       stream.on('error', reject);
//       stream.on('end', () => resolve(Buffer.concat(chunks).toString('utf-8')));
//     });
//   }
// }
