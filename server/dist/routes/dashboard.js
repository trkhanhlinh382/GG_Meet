"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.dashboardRouter = void 0;
const express_1 = require("express");
const auth_1 = require("../middleware/auth");
const invitation_model_1 = require("../models/invitation.model");
const meeting_model_1 = require("../models/meeting.model");
const notification_model_1 = require("../models/notification.model");
const task_model_1 = require("../models/task.model");
exports.dashboardRouter = (0, express_1.Router)();
exports.dashboardRouter.get("/", auth_1.requireAuth, async (req, res) => {
    const userId = req.user?.id;
    if (!userId) {
        res.status(401).json({ message: "Unauthorized" });
        return;
    }
    const [upcomingMeetings, invitations, tasks, notifications, meetingHistory] = await Promise.all([
        meeting_model_1.MeetingModel.find({ ownerId: userId, startTime: { $gte: new Date() } }).sort({ startTime: 1 }).limit(10),
        invitation_model_1.InvitationModel.find({ userId }).sort({ createdAt: -1 }).limit(10),
        task_model_1.TaskModel.find({ assigneeId: userId }).sort({ createdAt: -1 }).limit(20),
        notification_model_1.NotificationModel.find({ userId }).sort({ createdAt: -1 }).limit(20),
        meeting_model_1.MeetingModel.find({ ownerId: userId, endTime: { $lt: new Date() } }).sort({ endTime: -1 }).limit(10),
    ]);
    res.json({
        upcomingMeetings,
        invitations,
        tasks,
        notifications,
        meetingHistory,
    });
});
//# sourceMappingURL=dashboard.js.map