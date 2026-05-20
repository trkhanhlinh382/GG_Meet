import { Router } from "express";
import { requireAuth, type AuthRequest } from "../middleware/auth";
import { InvitationModel } from "../models/invitation.model";
import { MeetingMessageModel } from "../models/meeting-message.model";
import { MeetingModel } from "../models/meeting.model";
import { getMeetingRealtimeSnapshot } from "../realtime/meetingRealtime";

export const meetingDetailsRouter = Router();

meetingDetailsRouter.get("/:id/details", requireAuth, async (req: AuthRequest, res) => {
    // DEBUG LOG
    // eslint-disable-next-line no-console
    console.log("[MEETING DETAILS] meetingId:", req.params.id);
  const userId = req.user?.id;
    // eslint-disable-next-line no-console
    console.log("[MEETING DETAILS] userId:", userId);
  if (!userId) {
    res.status(401).json({ message: "Unauthorized" });
    return;
  }

  const meeting = await MeetingModel.findById(req.params.id).populate({ path: "ownerId", select: "fullName email" });
  // eslint-disable-next-line no-console
  console.log("[MEETING DETAILS] meeting.ownerId:", meeting?.ownerId?.toString?.() ?? meeting?.ownerId, "isOwner:", meeting?.ownerId?.toString?.() === userId);
  if (!meeting) {
    res.status(404).json({ message: "Meeting not found" });
    return;
  }

  // Nếu populate thì meeting.ownerId là object, nếu không thì là ObjectId
  let ownerId;
  if (meeting.ownerId && typeof meeting.ownerId === "object" && meeting.ownerId._id) {
    ownerId = meeting.ownerId._id.toString();
  } else {
    ownerId = meeting.ownerId.toString();
  }
  const isOwner = ownerId === userId;
  // Quyền truy cập: host hoặc participants
  const isParticipant = Array.isArray(meeting.participants)
    ? meeting.participants.map((id: any) => id.toString()).includes(userId)
    : false;
  if (!isOwner && !isParticipant) {
    res.status(403).json({ message: "Forbidden" });
    return;
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
