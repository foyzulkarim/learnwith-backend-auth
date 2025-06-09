import mongoose, { Schema, Document } from 'mongoose';
import { User as UserType, ROLES, UserRole } from './types'; // Added UserRole for clarity

// Create interface that extends Mongoose Document
export interface UserDocument extends Omit<UserType, 'id'>, Document {
  // The id will be provided by Document._id
  isDeleted?: boolean;
  deletedAt?: Date | null;
}

// Create Mongoose schema for User
const UserSchema = new Schema<UserDocument>(
  {
    email: { type: String, required: true, unique: true, index: true }, // Ensured index
    name: { type: String, index: true }, // Added index
    googleId: { type: String, sparse: true, unique: true }, // Remains sparse and unique
    role: {
      type: String,
      enum: ROLES, // ROLES should be an array of possible UserRole strings
      default: 'viewer' as UserRole,
      required: true,
      index: true, // Added index
    },
    password: { type: String }, // Added password field

    // Soft delete fields
    isDeleted: { type: Boolean, default: false, index: true },
    deletedAt: { type: Date, default: null, sparse: true }, // sparse: true if we only want to index documents where deletedAt is set
  },
  {
    timestamps: true, // Adds createdAt and updatedAt fields
  },
);

// Add indexes for timestamps if not automatically handled sufficiently by `timestamps: true`
// Mongoose does create these, but for frequent queries, explicit is fine.
UserSchema.index({ createdAt: 1 });
UserSchema.index({ updatedAt: 1 });

// Compound Indexes
// For finding non-deleted users of a specific role
UserSchema.index({ isDeleted: 1, role: 1 });
// For finding non-deleted users by email (though email is unique, this can optimize if queries always include isDeleted)
// UserSchema.index({ email: 1, isDeleted: 1 }); // This might be redundant given email's unique index,
                                                // but can be useful if queries *always* filter by isDeleted.
                                                // Let's keep it simple and rely on the unique email index for now,
                                                // unless specific performance issues arise.

// Create and export model (or export the function to create the model)
export const getUserModel = () => {
  // Check if model already exists to prevent model overwrite error
  return mongoose.models.User || mongoose.model<UserDocument>('User', UserSchema);
};
