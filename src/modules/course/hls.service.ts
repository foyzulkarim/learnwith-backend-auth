import { FastifyInstance } from 'fastify';
import { CourseHelpers } from './course.model';
import { videoStreamingConfig } from '../../config/video-streaming.config';
import { createLogger, Logger } from '../../utils/logger';
import { NotFoundError } from '../../utils/errors';

export class HLSService {
  private logger: Logger;

  constructor(private fastify: FastifyInstance) {
    this.logger = createLogger(fastify);
  }

  /**
   * Fetch and return full master playlist content with quality URLs rewritten
   * @param lessonId - The lesson ID to get the playlist for
   * @returns Modified playlist content and content type
   */
  async getModifiedMasterPlaylist(lessonId: string) {
    const logContext = this.logger.startOperation('HLSService.getModifiedMasterPlaylist', {
      lessonId,
    });

    try {
      this.logger.info(
        {
          operation: 'HLSService.getModifiedMasterPlaylist',
          step: 'fetching_lesson',
          lessonId,
        },
        `Fetching lesson data for HLS playlist: ${lessonId}`,
      );

      const lesson = await CourseHelpers.getLessonById(lessonId);

      if (!lesson) {
        this.logger.warn(
          {
            operation: 'HLSService.getModifiedMasterPlaylist',
            step: 'lesson_not_found',
            lessonId,
          },
          `Lesson not found for HLS playlist: ${lessonId}`,
        );

        throw new NotFoundError('Lesson not found');
      }

      this.logger.info(
        {
          operation: 'HLSService.getModifiedMasterPlaylist',
          step: 'lesson_found',
          lessonId,
          lessonTitle: lesson.title,
          hasVideoUrl: !!lesson.videoUrl,
        },
        `Lesson found for HLS playlist: ${lesson.title}`,
      );

      // Get the API base URL from config
      const config = videoStreamingConfig();
      const apiBaseUrl = config.API_BASE_URL;

      this.logger.debug(
        {
          operation: 'HLSService.getModifiedMasterPlaylist',
          step: 'generating_playlist',
          lessonId,
          apiBaseUrl,
          qualityLevels: ['1080', '720', '480', '360'],
        },
        'Generating HLS master playlist with multiple quality levels',
      );

      // Generate playlist content that points to the API endpoint with multiple quality options
      const modifiedPlaylist = `
#EXTM3U
#EXT-X-STREAM-INF:BANDWIDTH=4000000,RESOLUTION=1920x1080
${apiBaseUrl}/api/hls/stream/playlist/${lessonId}/1080/playlist.m3u8
#EXT-X-STREAM-INF:BANDWIDTH=2000000,RESOLUTION=1280x720
${apiBaseUrl}/api/hls/stream/playlist/${lessonId}/720/playlist.m3u8
#EXT-X-STREAM-INF:BANDWIDTH=1000000,RESOLUTION=854x480
${apiBaseUrl}/api/hls/stream/playlist/${lessonId}/480/playlist.m3u8
#EXT-X-STREAM-INF:BANDWIDTH=500000,RESOLUTION=640x360
${apiBaseUrl}/api/hls/stream/playlist/${lessonId}/360/playlist.m3u8
`.trim();

      const result = {
        content: modifiedPlaylist,
        contentType: 'application/x-mpegURL' as const,
      };

      this.logger.endOperation(
        logContext,
        `Successfully generated HLS master playlist for lesson: ${lesson.title}`,
        {
          lessonId,
          lessonTitle: lesson.title,
          playlistLength: modifiedPlaylist.length,
          qualityLevels: 4,
          contentType: result.contentType,
        },
      );

      // Log business metrics for video streaming
      this.logger.logMetric(
        'hls_master_playlist_generated',
        {
          lessonId,
          lessonTitle: lesson.title,
          qualityLevels: 4,
          playlistSize: modifiedPlaylist.length,
        },
        'HLS master playlist generation metric',
      );

      return result;
    } catch (error) {
      this.logger.errorOperation(
        logContext,
        error,
        `Failed to generate HLS master playlist for lesson: ${lessonId}`,
        { lessonId },
      );
      throw error;
    }
  }

  /**
   * Generate quality-specific playlist for a lesson
   * @param lessonId - The lesson ID
   * @param quality - The quality level (1080, 720, 480, 360)
   * @returns Quality-specific playlist content
   */
  async getQualityPlaylist(lessonId: string, quality: string) {
    const logContext = this.logger.startOperation('HLSService.getQualityPlaylist', {
      lessonId,
      quality,
    });

    try {
      this.logger.info(
        {
          operation: 'HLSService.getQualityPlaylist',
          step: 'validating_quality',
          lessonId,
          quality,
          supportedQualities: ['1080', '720', '480', '360'],
        },
        `Generating quality-specific playlist: ${quality}p for lesson ${lessonId}`,
      );

      const supportedQualities = ['1080', '720', '480', '360'];
      if (!supportedQualities.includes(quality)) {
        this.logger.warn(
          {
            operation: 'HLSService.getQualityPlaylist',
            step: 'invalid_quality',
            lessonId,
            quality,
            supportedQualities,
          },
          `Invalid quality requested: ${quality}`,
        );

        throw new Error(
          `Unsupported quality: ${quality}. Supported qualities: ${supportedQualities.join(', ')}`,
        );
      }

      const lesson = await CourseHelpers.getLessonById(lessonId);

      if (!lesson) {
        this.logger.warn(
          {
            operation: 'HLSService.getQualityPlaylist',
            step: 'lesson_not_found',
            lessonId,
            quality,
          },
          `Lesson not found for quality playlist: ${lessonId}`,
        );

        throw new NotFoundError('Lesson not found');
      }

      this.logger.info(
        {
          operation: 'HLSService.getQualityPlaylist',
          step: 'lesson_found',
          lessonId,
          quality,
          lessonTitle: lesson.title,
        },
        `Lesson found for quality playlist: ${lesson.title} (${quality}p)`,
      );

      // Generate a simple playlist for the specific quality
      // In a real implementation, this would point to actual video segments
      const config = videoStreamingConfig();
      const apiBaseUrl = config.API_BASE_URL;

      const qualityPlaylist = `
#EXTM3U
#EXT-X-VERSION:3
#EXT-X-TARGETDURATION:10
#EXT-X-MEDIA-SEQUENCE:0
#EXTINF:10.0,
${apiBaseUrl}/api/hls/stream/segment/${lessonId}/${quality}/segment0.ts
#EXTINF:10.0,
${apiBaseUrl}/api/hls/stream/segment/${lessonId}/${quality}/segment1.ts
#EXTINF:10.0,
${apiBaseUrl}/api/hls/stream/segment/${lessonId}/${quality}/segment2.ts
#EXT-X-ENDLIST
`.trim();

      const result = {
        content: qualityPlaylist,
        contentType: 'application/x-mpegURL' as const,
      };

      this.logger.endOperation(
        logContext,
        `Successfully generated ${quality}p playlist for lesson: ${lesson.title}`,
        {
          lessonId,
          quality,
          lessonTitle: lesson.title,
          playlistLength: qualityPlaylist.length,
          segmentCount: 3,
        },
      );

      // Log business metrics for quality-specific streaming
      this.logger.logMetric(
        'hls_quality_playlist_generated',
        {
          lessonId,
          quality,
          lessonTitle: lesson.title,
          segmentCount: 3,
          playlistSize: qualityPlaylist.length,
        },
        'HLS quality playlist generation metric',
      );

      return result;
    } catch (error) {
      this.logger.errorOperation(
        logContext,
        error,
        `Failed to generate ${quality}p playlist for lesson: ${lessonId}`,
        { lessonId, quality },
      );
      throw error;
    }
  }
}

// Legacy function for backward compatibility
export async function getModifiedMasterPlaylist(lessonId: string) {
  // This is a legacy function - in a real implementation, you'd want to inject the FastifyInstance
  // For now, we'll create a minimal implementation that logs to console
  console.warn(
    'Using legacy getModifiedMasterPlaylist function - consider using HLSService class instead',
  );

  const lesson = await CourseHelpers.getLessonById(lessonId);
  if (!lesson) throw new Error('Lesson not found');

  const config = videoStreamingConfig();
  const apiBaseUrl = config.API_BASE_URL;

  const modifiedPlaylist = `
#EXTM3U
#EXT-X-STREAM-INF:BANDWIDTH=4000000,RESOLUTION=1920x1080
${apiBaseUrl}/api/hls/stream/playlist/${lessonId}/1080/playlist.m3u8
#EXT-X-STREAM-INF:BANDWIDTH=2000000,RESOLUTION=1280x720
${apiBaseUrl}/api/hls/stream/playlist/${lessonId}/720/playlist.m3u8
#EXT-X-STREAM-INF:BANDWIDTH=1000000,RESOLUTION=854x480
${apiBaseUrl}/api/hls/stream/playlist/${lessonId}/480/playlist.m3u8
#EXT-X-STREAM-INF:BANDWIDTH=500000,RESOLUTION=640x360
${apiBaseUrl}/api/hls/stream/playlist/${lessonId}/360/playlist.m3u8
`.trim();

  return {
    content: modifiedPlaylist,
    contentType: 'application/x-mpegURL' as const,
  };
}
