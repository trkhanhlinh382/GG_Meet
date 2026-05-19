
import { Router } from "express";
import { requireAuth, type AuthRequest } from "../middleware/auth";
import { NotificationModel } from "../models/notification.model";

export const notificationRouter = Router();

notificationRouter.get("/", requireAuth, async (req: AuthRequest, res) => {
  const userId = req.user?.id;
  if (!userId) {
    res.status(401).json({ message: "Unauthorized" });
    return;
  }
  const notifications = await NotificationModel.find({ userId }).sort({ createdAt: -1 }).limit(20);
  res.json(notifications);
});

notificationRouter.post("/:id/read", requireAuth, async (req: AuthRequest, res) => {
  const userId = req.user?.id;
  const { id } = req.params;
  if (!userId) {
    res.status(401).json({ message: "Unauthorized" });
    return;
  }
  const notification = await NotificationModel.findOneAndUpdate(
    { _id: id, userId },
    { isRead: true },
    { new: true }
  );
  if (!notification) {
    res.status(404).json({ message: "Notification not found" });
    return;
  }
  res.json(notification);
});
