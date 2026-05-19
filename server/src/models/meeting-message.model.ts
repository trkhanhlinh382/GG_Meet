import { Schema, Types, model } from "mongoose";

interface MeetingMessage {
  meetingId: Types.ObjectId;
  senderUserId?: Types.ObjectId;
  senderName: string;
  message: string;
  createdAt: Date;
}

const meetingMessageSchema = new Schema<MeetingMessage>(
  {
    meetingId: { type: Schema.Types.ObjectId, ref: "Meeting", required: true, index: true },
    senderUserId: { type: Schema.Types.ObjectId, ref: "User" },
    senderName: { type: String, required: true },
    message: { type: String, required: true },
    createdAt: { type: Date, default: Date.now },
  },
  { timestamps: false },
);

export const MeetingMessageModel = model<MeetingMessage>("MeetingMessage", meetingMessageSchema);
