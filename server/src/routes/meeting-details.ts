import { Router } from "express";
import { requireAuth, type AuthRequest } from "../middleware/auth";
import { InvitationModel } from "../models/invitation.model";
import { MeetingMessageModel } from "../models/meeting-message.model";
import { MeetingModel } from "../models/meeting.model";
import { getMeetingRealtimeSnapshot } from "../realtime/meetingRealtime";

export const meetingDetailsRouter = Router();

meetingDetailsRouter.get("/:id/details", requireAuth, async (req: AuthRequest, res) => {
  const userId = req.user?.id;
  if (!userId) {
    res.status(401).json({ message: "Unauthorized" });
    return;
  }

  const meeting = await MeetingModel.findById(req.params.id).populate({ path: "ownerId", select: "fullName email" });
  if (!meeting) {
    res.status(404).json({ message: "Meeting not found" });
    return;
  }

  const isOwner = meeting.ownerId.toString() === userId;
  if (!isOwner) {
    const invitation = await InvitationModel.findOne({
      meetingId: meeting.id,
      userId,
      status: "accepted",
    });

    if (!invitation) {
      res.status(403).json({ message: "Forbidden" });
      return;
    }
  }

  const messages = await MeetingMessageModel.find({ meetingId: meeting.id }).sort({ createdAt: 1 }).limit(2000);
  const invitations = await InvitationModel.find({ meetingId: meeting.id })
    .populate("userId", "fullName email")
    .sort({ updatedAt: -1 })
    .limit(500);
  const realtimeSnapshot = getMeetingRealtimeSnapshot(meeting.id);
  const waitingRequests = isOwner ? realtimeSnapshot?.waiting ?? [] : [];

  res.json({
    meeting,
    messages,
    invitations,
    waitingRequests,
  });
});
