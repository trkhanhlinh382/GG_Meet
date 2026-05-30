"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.notificationRouter = void 0;
const express_1 = require("express");
const auth_1 = require("../middleware/auth");
const notification_model_1 = require("../models/notification.model");
exports.notificationRouter = (0, express_1.Router)();
exports.notificationRouter.get("/", auth_1.requireAuth, async (req, res) => {
    const userId = req.user?.id;
    if (!userId) {
        res.status(401).json({ message: "Unauthorized" });
        return;
    }
    const notifications = await notification_model_1.NotificationModel.find({ userId }).sort({ createdAt: -1 }).limit(20);
    res.json(notifications);
});
exports.notificationRouter.post("/:id/read", auth_1.requireAuth, async (req, res) => {
    const userId = req.user?.id;
    const { id } = req.params;
    if (!userId) {
        res.status(401).json({ message: "Unauthorized" });
        return;
    }
    const notification = await notification_model_1.NotificationModel.findOneAndUpdate({ _id: id, userId }, { isRead: true }, { new: true });
    if (!notification) {
        res.status(404).json({ message: "Notification not found" });
        return;
    }
    res.json(notification);
});
//# sourceMappingURL=notifications.js.map