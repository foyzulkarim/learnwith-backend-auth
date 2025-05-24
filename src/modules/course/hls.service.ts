import { CourseHelpers } from './course.model';
import { videoStreamingConfig } from '../../config/video-streaming.config';

// Fetch and return full master playlist content with quality URLs rewritten
export async function getModifiedMasterPlaylist(lessonId: string) {
  const lesson = await CourseHelpers.getLessonById(lessonId);
  if (!lesson) throw new Error('Lesson not found');

  // Get the API base URL from config
  const config = videoStreamingConfig();
  const apiBaseUrl = config.API_BASE_URL;

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

  return {
    content: modifiedPlaylist,
    contentType: 'application/x-mpegURL' as const,
  };
}
