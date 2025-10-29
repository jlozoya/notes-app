import mongoose, { Schema, Document, Types } from "mongoose";

export interface INote extends Document {
  user: Types.ObjectId;
  title: string;
  html: string;
  updatedAt: Date;
  isPublic: boolean;
  shareCode?: string;
  sharedWith: Types.ObjectId[];
}

const NoteSchema = new Schema<INote>(
  {
    user: { type: Schema.Types.ObjectId, ref: "User", required: true },
    title: { type: String, default: "Untitled" },
    html: { type: String, default: "" },
    isPublic: { type: Boolean, default: false, index: true },
    shareCode: { type: String, index: true, sparse: true },
    sharedWith: [{ type: Schema.Types.ObjectId, ref: "User", index: true }],
  },
  { timestamps: true }
);

export const Note = mongoose.model<INote>("Note", NoteSchema);
