import { Schema, Types, model } from "mongoose";

interface Notification {
  userId: Types.ObjectId;
  title: string;
  content: string;
  isRead: boolean;
}

const notificationSchema = new Schema<Notification>(
  {
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    title: { type: String, required: true },
    content: { type: String, required: true },
    isRead: { type: Boolean, default: false },
  },
  { timestamps: true },
);

export const NotificationModel = model<Notification>("Notification", notificationSchema);
