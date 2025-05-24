import { FastifyInstance } from 'fastify';
import { S3Client, GetObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { videoStreamingConfig } from '../../config/video-streaming.config';

export class ImprovedVideoStreamingService {
  private s3Client: S3Client;
  private bucketName: string;
  private signedUrlExpiration: number;

  constructor(private fastify: FastifyInstance) {
    // Get validated config
    const config = videoStreamingConfig();

    // Initialize S3 client with Cloudflare R2
    this.s3Client = new S3Client({
      region: 'auto',
      endpoint: `https://${config.CLOUDFLARE_ACCOUNT_ID}.r2.cloudflarestorage.com`,
      credentials: {
        accessKeyId: config.R2_ACCESS_KEY_ID,
        secretAccessKey: config.R2_SECRET_ACCESS_KEY,
      },
    });

    this.bucketName = config.R2_BUCKET_NAME;
    // Convert string to number
    this.signedUrlExpiration = Number(config.SIGNED_URL_EXPIRATION);

    this.fastify.log.info('S3 client initialized with bucket: ' + this.bucketName);
  }

  /**
   * Get a direct pre-signed URL for a specific S3 object
   */
  async getSignedUrl(objectKey: string): Promise<string> {
    try {
      const command = new GetObjectCommand({
        Bucket: this.bucketName,
        Key: objectKey,
      });

      this.fastify.log.info(`Generating signed URL for: ${objectKey}`);

      return getSignedUrl(this.s3Client, command, {
        expiresIn: this.signedUrlExpiration,
      });
    } catch (error) {
      this.fastify.log.error(`Failed to generate signed URL: ${error}`);
      throw new Error(`Failed to generate signed URL: ${(error as Error).message}`);
    }
  }
}
