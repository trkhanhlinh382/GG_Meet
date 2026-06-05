import { Schema, model } from "mongoose";

export type UserRole = "host" | "admin";

interface User {
  googleId: string;
  email: string;
  fullName: string;
  avatar?: string;
  timezone?: string;
  role: UserRole;
}

const userSchema = new Schema<User>(
  {
    googleId: { type: String, required: true, unique: true },
    email: { type: String, required: true, unique: true },
    fullName: { type: String, required: true },
    avatar: { type: String },
    timezone: { type: String, default: "UTC" },
    role: {
      type: String,
      enum: ["host", "admin"],
      default: "host",
    },
  },

  { timestamps: true },
);

export const UserModel = model<User>("User", userSchema);
