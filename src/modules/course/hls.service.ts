import { CourseHelpers } from './course.model';
import { videoStreamingConfig } from '../../config/video-streaming.config';

// Fetch and return full master playlist content with quality URLs rewritten
export async function getModifiedMasterPlaylist(lessonId: string) {
  const lesson = await CourseHelpers.getLessonById(lessonId);
  if (!lesson) throw new Error('Lesson not found');

  // Get the API base URL from config
  const config = videoStreamingConfig();
  const apiBaseUrl = config.API_BASE_URL;

  // Generate playlist content that points to the API endpoint
  const modifiedPlaylist = `
#EXTM3U
#EXT-X-STREAM-INF:BANDWIDTH=2000000,RESOLUTION=1280x720
${apiBaseUrl}/api/hls/stream/playlist/${lessonId}/720/playlist.m3u8
`.trim();

  return {
    content: modifiedPlaylist,
    contentType: 'application/x-mpegURL' as const,
  };
}
