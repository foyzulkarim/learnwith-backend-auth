import mongoose, { Schema, Document } from 'mongoose';
import { User as UserType, ROLES } from './types';

// Create interface that extends Mongoose Document
export interface UserDocument extends Omit<UserType, 'id'>, Document {
  // The id will be provided by Document._id
}

// Create Mongoose schema for User
const UserSchema = new Schema<UserDocument>(
  {
    email: { type: String, required: true, unique: true },
    name: { type: String },
    googleId: { type: String, sparse: true, unique: true },
    role: {
      type: String,
      enum: ROLES,
      default: 'viewer',
      required: true,
    },
    // Add any other fields needed
  },
  {
    timestamps: true, // Adds createdAt and updatedAt fields
  },
);

// Create and export model (or export the function to create the model)
export const getUserModel = () => {
  // Check if model already exists to prevent model overwrite error
  return mongoose.models.User || mongoose.model<UserDocument>('User', UserSchema);
};
