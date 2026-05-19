import { Router } from "express";
import { requireAuth, type AuthRequest } from "../middleware/auth";
import { InvitationModel } from "../models/invitation.model";
import { MeetingModel } from "../models/meeting.model";
import { NotificationModel } from "../models/notification.model";
import { TaskModel } from "../models/task.model";

export const dashboardRouter = Router();

const meetingOwnerPopulate = { path: "ownerId", select: "fullName email" } as const;

dashboardRouter.get("/", requireAuth, async (req: AuthRequest, res) => {
  const userId = req.user?.id;

  if (!userId) {
    res.status(401).json({ message: "Unauthorized" });
    return;
  }

  const now = new Date();

  const acceptedInvitations = await InvitationModel.find({ userId, status: "accepted" }).select("meetingId").lean();
  const invitedMeetingIds = acceptedInvitations.map((invitation) => invitation.meetingId);
  const meetingScope = {
    status: { $ne: "cancelled" as const },
    $or: [{ ownerId: userId }, { _id: { $in: invitedMeetingIds } }],
  };

  const [ongoingMeetings, upcomingMeetings, invitations, tasks, notifications, meetingHistory] = await Promise.all([
    MeetingModel.find({ ...meetingScope, startTime: { $lte: now }, endTime: { $gte: now } }).populate(meetingOwnerPopulate).sort({ startTime: 1 }).limit(10),
    MeetingModel.find({ ...meetingScope, startTime: { $gt: now } }).populate(meetingOwnerPopulate).sort({ startTime: 1 }).limit(10),
    InvitationModel.find({ userId, status: "pending" }).sort({ createdAt: -1 }).limit(10).populate({ path: "meetingId", populate: meetingOwnerPopulate }),
    TaskModel.find({ assigneeId: userId }).sort({ createdAt: -1 }).limit(20),
    NotificationModel.find({ userId }).sort({ createdAt: -1 }).limit(20),
    MeetingModel.find({ ...meetingScope, endTime: { $lt: now } }).populate(meetingOwnerPopulate).sort({ endTime: -1 }).limit(10),
  ]);

  res.json({
    ongoingMeetings,
    upcomingMeetings,
    invitations,
    tasks,
    notifications,
    meetingHistory,
  });
});
