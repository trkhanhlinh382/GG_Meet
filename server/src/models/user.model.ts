import { Schema, model } from "mongoose";

export type UserRole = "personal" | "freelancer" | "team_member" | "host" | "manager" | "admin" | "super_admin";

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
      enum: ["personal", "freelancer", "team_member", "host", "manager", "admin", "super_admin"],
      default: "personal",
    },
  },
  { timestamps: true },
);

export const UserModel = model<User>("User", userSchema);
