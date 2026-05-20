import { Schema, Types, model } from "mongoose";

export type MeetingCategory = "personal" | "interview" | "team_meeting" | "client_meeting" | "training";
export type MeetingStatus = "scheduled" | "live" | "ended" | "cancelled";
export type PrivacyMode = "public" | "private";

interface Meeting {
  ownerId: Types.ObjectId;
  title: string;
  description?: string;
  category: MeetingCategory;
  startTime: Date;
  endTime: Date;
  status: MeetingStatus;
  privacyMode: PrivacyMode;
  waitingRoomEnabled: boolean;
  recordingEnabled: boolean;
  recordingUrl?: string;
  password?: string;
  participants: Types.ObjectId[];
}

const meetingSchema = new Schema<Meeting>(
  {
    ownerId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    title: { type: String, required: true },
    description: { type: String },
    category: {
      type: String,
      enum: ["personal", "interview", "team_meeting", "client_meeting", "training"],
      default: "team_meeting",
    },
    startTime: { type: Date, required: true },
    endTime: { type: Date, required: true },
    status: {
      type: String,
      enum: ["scheduled", "live", "ended", "cancelled"],
      default: "scheduled",
    },
    privacyMode: { type: String, enum: ["public", "private"], default: "private" },
    waitingRoomEnabled: { type: Boolean, default: true },
    recordingEnabled: { type: Boolean, default: false },
    recordingUrl: { type: String },
    password: { type: String },
    participants: [{ type: Schema.Types.ObjectId, ref: "User" }],
  },
  { timestamps: true },
);

export const MeetingModel = model<Meeting>("Meeting", meetingSchema);
