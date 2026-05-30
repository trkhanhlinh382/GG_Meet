import { Schema, Types, model } from "mongoose";

interface MeetingMessage {
  meetingId: Types.ObjectId;
  senderUserId?: Types.ObjectId;
  senderName: string;
  message?: string;
  fileData?: string;
  fileName?: string;
  fileType?: string;
  sticker?: string;
  isPinned?: boolean;
  createdAt: Date;
}

const meetingMessageSchema = new Schema<MeetingMessage>(
  {
    meetingId: { type: Schema.Types.ObjectId, ref: "Meeting", required: true, index: true },
    senderUserId: { type: Schema.Types.ObjectId, ref: "User" },
    senderName: { type: String, required: true },
    message: { type: String },
    fileData: { type: String },
    fileName: { type: String },
    fileType: { type: String },
    sticker: { type: String },
    isPinned: { type: Boolean, default: false },
    createdAt: { type: Date, default: Date.now },
  },
  { timestamps: false },
);

export const MeetingMessageModel = model<MeetingMessage>("MeetingMessage", meetingMessageSchema);
