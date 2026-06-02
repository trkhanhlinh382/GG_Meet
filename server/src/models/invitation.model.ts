import { Schema, Types, model } from "mongoose";

export type InvitationStatus = "pending" | "accepted" | "rejected";

interface Invitation {
  meetingId: Types.ObjectId;
  userId: Types.ObjectId;
  status: InvitationStatus;
}

const invitationSchema = new Schema<Invitation>(
  {
    meetingId: { type: Schema.Types.ObjectId, ref: "Meeting", required: true },
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    status: { type: String, enum: ["pending", "accepted", "rejected"], default: "pending" },
  },
  { timestamps: true },
);

export const InvitationModel = model<Invitation>("Invitation", invitationSchema);
