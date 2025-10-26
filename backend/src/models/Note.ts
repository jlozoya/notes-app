import mongoose, { Schema, Document } from "mongoose";

export interface INote extends Document {
  user: mongoose.Types.ObjectId;
  title: string;
  html: string;
  updatedAt: Date;
}

const noteSchema = new Schema<INote>(
  {
    user: { type: Schema.Types.ObjectId, ref: "User", required: true },
    title: { type: String, default: "Untitled" },
    html: { type: String, default: "" },
  },
  { timestamps: true }
);

export const Note = mongoose.model<INote>("Note", noteSchema);
