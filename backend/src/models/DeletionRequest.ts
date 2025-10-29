import mongoose, { Schema, Types } from "mongoose";

export interface IDeletionRequest {
  userId: Types.ObjectId;
  email: string;
  reason?: string;
  status: "pending" | "verified" | "completed" | "rejected";
  token: string;
  requestedAt: Date;
  verifiedAt?: Date;
  completedAt?: Date;
}

const DeletionRequestSchema = new Schema<IDeletionRequest>({
  userId: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true, unique: true },
  email: { type: String, required: true, index: true },
  reason: { type: String },
  status: { type: String, enum: ["pending","verified","completed","rejected"], default: "pending" },
  token: { type: String, required: true, index: true, unique: true },
  requestedAt: { type: Date, default: Date.now },
  verifiedAt: { type: Date },
  completedAt: { type: Date },
});

export const DeletionRequest = mongoose.model<IDeletionRequest>("DeletionRequest", DeletionRequestSchema);
