// src/modules/course/video.model.ts
import mongoose, { Schema, Model } from 'mongoose';

export interface VideoDocument {
  _id: mongoose.Types.ObjectId;
  title: string;
  description?: string;
  hlsPath: string;
  duration?: number; // In seconds
  courseId: mongoose.Types.ObjectId;
  thumbnailUrl?: string;
  createdAt: Date;
  updatedAt: Date;
}

const VideoSchema = new Schema<VideoDocument>(
  {
    title: { type: String, required: true },
    description: { type: String },
    hlsPath: { type: String, required: true },
    duration: { type: Number },
    courseId: { type: Schema.Types.ObjectId, ref: 'Course', required: true },
    thumbnailUrl: { type: String },
  },
  { timestamps: true },
);

// Indexes for better query performance
VideoSchema.index({ courseId: 1 });
VideoSchema.index({ title: 'text', description: 'text' });

// Model getter
export const getVideoModel = (): Model<VideoDocument> => {
  return (
    (mongoose.models.Video as Model<VideoDocument>) ||
    mongoose.model<VideoDocument>('Video', VideoSchema)
  );
};

// Helper methods for the video model
export const VideoHelpers = {
  // Get all videos for a course
  getVideosByCourseId: async (courseId: string) => {
    const VideoModel = getVideoModel();
    return await VideoModel.find({ courseId: new mongoose.Types.ObjectId(courseId) });
  },

  // Get a video by ID
  getVideoById: async (videoId: string) => {
    const VideoModel = getVideoModel();
    return await VideoModel.findById(videoId);
  },

  // Add a new video
  addVideo: async (videoData: {
    title: string;
    description?: string;
    hlsPath: string;
    duration?: number;
    courseId: string;
    thumbnailUrl?: string;
  }) => {
    const VideoModel = getVideoModel();
    const newVideo = new VideoModel({
      ...videoData,
      courseId: new mongoose.Types.ObjectId(videoData.courseId),
    });
    return await newVideo.save();
  },

  // Update a video
  updateVideo: async (
    videoId: string,
    videoData: Partial<{
      title: string;
      description: string;
      hlsPath: string;
      duration: number;
      thumbnailUrl: string;
    }>,
  ) => {
    const VideoModel = getVideoModel();
    return await VideoModel.findByIdAndUpdate(videoId, videoData, { new: true });
  },

  // Delete a video
  deleteVideo: async (videoId: string) => {
    const VideoModel = getVideoModel();
    return await VideoModel.findByIdAndDelete(videoId);
  },
};
