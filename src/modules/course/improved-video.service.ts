import { FastifyInstance } from 'fastify';
import { S3Client, GetObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { videoStreamingConfig } from '../../config/video-streaming.config';
import { withLogglyTags } from '../../utils/logglyHelper';
import { createServiceLogger } from '../../utils/logger';

export class ImprovedVideoStreamingService {
  private s3Client: S3Client;
  private bucketName: string;
  private signedUrlExpiration: number;
  private logger = createServiceLogger('VideoStreamingService');

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

    this.logger.info(
      {
        bucketName: this.bucketName,
        expiration: this.signedUrlExpiration,
        ...withLogglyTags(['video', 'r2-client-init']),
      },
      'S3 client initialized for video streaming',
    );
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

      this.logger.debug(
        {
          objectKey,
          bucket: this.bucketName,
          expiration: this.signedUrlExpiration,
          ...withLogglyTags(['video', 'signed-url-request']),
        },
        'Generating signed URL for video segment',
      );

      const url = await getSignedUrl(this.s3Client, command, {
        expiresIn: this.signedUrlExpiration,
      });

      // Don't log the full URL as it contains sensitive signature information
      this.logger.debug(
        {
          objectKey,
          urlLength: url.length,
          ...withLogglyTags(['video', 'signed-url-generated']),
        },
        'Generated signed URL successfully',
      );

      return url;
    } catch (error) {
      this.logger.error(
        {
          err: error,
          objectKey,
          bucket: this.bucketName,
          ...withLogglyTags(['video', 'signed-url-error']),
        },
        'Failed to generate signed URL',
      );

      throw new Error(`Failed to generate signed URL: ${(error as Error).message}`);
    }
  }
}
