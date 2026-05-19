import { Schema, Types, model } from "mongoose";

export type ReminderType = "one_day" | "one_hour" | "fifteen_minutes" | "start";

interface ReminderLog {
  meetingId: Types.ObjectId;
  userId: Types.ObjectId;
  reminderType: ReminderType;
  sentAt: Date;
}

const reminderLogSchema = new Schema<ReminderLog>(
  {
    meetingId: { type: Schema.Types.ObjectId, ref: "Meeting", required: true },
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    reminderType: {
      type: String,
      enum: ["one_day", "one_hour", "fifteen_minutes", "start"],
      required: true,
    },
    sentAt: { type: Date, default: Date.now },
  },
  { timestamps: true },
);

reminderLogSchema.index({ meetingId: 1, userId: 1, reminderType: 1 }, { unique: true });

export const ReminderLogModel = model<ReminderLog>("ReminderLog", reminderLogSchema);
