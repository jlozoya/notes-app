import mongoose, { Schema } from "mongoose";
import bcrypt from "bcrypt";
import { DeleteOneModel } from "mongoose";

export interface IUser extends Document {
  _id?: mongoose.Types.ObjectId;
  email: string;
  password: string;
  emailVerified?: boolean;
  emailVerifyTokenHash?: string | null;
  emailVerifyExpiresAt?: Date | null;
  passwordResetToken?: string | null;
  passwordResetTokenExp?: Date | null;
  comparePassword(password: string): Promise<boolean>;
  save(): Promise<IUser>;
  deleteOne(): DeleteOneModel;
}

const UserSchema = new Schema<IUser>(
  {
    email: { type: String, unique: true, required: true, lowercase: true, trim: true },
    password: { type: String, required: true },
    emailVerified: { type: Boolean, default: false },
    emailVerifyTokenHash: { type: String, default: null },
    emailVerifyExpiresAt: { type: Date, default: null },
    passwordResetToken: { type: String, default: null },
    passwordResetTokenExp: { type: Date, default: null },
  },
  { timestamps: true }
);

UserSchema.pre("save", async function (next) {
  if (!this.isModified("password")) return next();
  this.password = await bcrypt.hash(this.password, 10);
  next();
});

UserSchema.methods.comparePassword = function (cand: string) {
  return bcrypt.compare(cand, this.password);
};

export const User = mongoose.model<IUser>("User", UserSchema);
