import { Router } from "express";
import { requireAuth, type AuthRequest } from "../middleware/auth";
import { InvitationModel } from "../models/invitation.model";
import { MeetingModel } from "../models/meeting.model";
import { NotificationModel } from "../models/notification.model";
import { TaskModel } from "../models/task.model";

export const dashboardRouter = Router();

dashboardRouter.get("/", requireAuth, async (req: AuthRequest, res) => {
  const userId = req.user?.id;

  if (!userId) {
    res.status(401).json({ message: "Unauthorized" });
    return;
  }

  const [upcomingMeetings, invitations, tasks, notifications, meetingHistory] = await Promise.all([
    MeetingModel.find({ ownerId: userId, startTime: { $gte: new Date() } }).sort({ startTime: 1 }).limit(10),
    InvitationModel.find({ userId }).sort({ createdAt: -1 }).limit(10),
    TaskModel.find({ assigneeId: userId }).sort({ createdAt: -1 }).limit(20),
    NotificationModel.find({ userId }).sort({ createdAt: -1 }).limit(20),
    MeetingModel.find({ ownerId: userId, endTime: { $lt: new Date() } }).sort({ endTime: -1 }).limit(10),
  ]);

  res.json({
    upcomingMeetings,
    invitations,
    tasks,
    notifications,
    meetingHistory,
  });
});
