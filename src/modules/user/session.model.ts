import mongoose, { Schema, Document } from 'mongoose';

export interface SessionDocument extends Document {
  userId: mongoose.Types.ObjectId;
  refreshToken: string;
  deviceInfo?: string;
  ipAddress?: string;
  userAgent?: string;
  createdAt: Date;
  expiresAt: Date;
  lastUsedAt: Date;
  isActive: boolean;
}

const SessionSchema = new Schema<SessionDocument>(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    refreshToken: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },
    deviceInfo: { type: String },
    ipAddress: { type: String },
    userAgent: { type: String },
    expiresAt: {
      type: Date,
      required: true,
      index: { expireAfterSeconds: 0 }, // MongoDB TTL - auto cleanup
    },
    lastUsedAt: {
      type: Date,
      default: Date.now,
    },
    isActive: {
      type: Boolean,
      default: true,
      index: true,
    },
  },
  {
    timestamps: true, // Adds createdAt and updatedAt
  },
);

// Compound index for efficient queries
SessionSchema.index({ userId: 1, isActive: 1 });
SessionSchema.index({ refreshToken: 1, isActive: 1 });

export const getSessionModel = () => {
  return mongoose.models.Session || mongoose.model<SessionDocument>('Session', SessionSchema);
};
