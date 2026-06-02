"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.startReminderScheduler = void 0;
const node_cron_1 = __importDefault(require("node-cron"));
const invitation_model_1 = require("../models/invitation.model");
const meeting_model_1 = require("../models/meeting.model");
const notification_model_1 = require("../models/notification.model");
const reminder_log_model_1 = require("../models/reminder-log.model");
const reminderRules = [
    { type: "one_day", offsetMinutes: 24 * 60, title: "Cuộc họp diễn ra sau 1 ngày" },
    { type: "one_hour", offsetMinutes: 60, title: "Cuộc họp diễn ra sau 1 giờ" },
    { type: "fifteen_minutes", offsetMinutes: 15, title: "Cuộc họp diễn ra sau 15 phút" },
    { type: "start", offsetMinutes: 0, title: "Cuộc họp đã bắt đầu" },
];
const shouldTriggerReminder = (startTime, now, offsetMinutes) => {
    const target = startTime.getTime() - offsetMinutes * 60_000;
    return Math.abs(target - now.getTime()) <= 60_000;
};
const startReminderScheduler = () => {
    node_cron_1.default.schedule("* * * * *", async () => {
        const now = new Date();
        const horizon = new Date(now.getTime() + 24 * 60 * 60_000 + 60_000);
        const meetings = await meeting_model_1.MeetingModel.find({
            startTime: { $gte: new Date(now.getTime() - 61_000), $lte: horizon },
            status: { $in: ["scheduled", "live"] },
        });
        for (const meeting of meetings) {
            for (const rule of reminderRules) {
                if (!shouldTriggerReminder(meeting.startTime, now, rule.offsetMinutes)) {
                    continue;
                }
                const acceptedInvitations = await invitation_model_1.InvitationModel.find({
                    meetingId: meeting.id,
                    status: "accepted",
                });
                const userIds = [meeting.ownerId.toString(), ...acceptedInvitations.map((item) => item.userId.toString())];
                for (const userId of userIds) {
                    const alreadySent = await reminder_log_model_1.ReminderLogModel.findOne({
                        meetingId: meeting.id,
                        userId,
                        reminderType: rule.type,
                    });
                    if (alreadySent) {
                        continue;
                    }
                    let content = "";
                    if (rule.type === "start") {
                        content = `Cuộc họp "${meeting.title}" đã bắt đầu. Hãy tham gia ngay!`;
                    }
                    else {
                        const timeStr = new Date(meeting.startTime).toLocaleString("vi-VN", {
                            hour: "2-digit",
                            minute: "2-digit",
                            day: "2-digit",
                            month: "2-digit",
                            year: "numeric",
                        });
                        content = `Cuộc họp "${meeting.title}" sẽ bắt đầu vào lúc ${timeStr}.`;
                    }
                    await notification_model_1.NotificationModel.create({
                        userId,
                        title: rule.title,
                        content,
                        isRead: false,
                    });
                    await reminder_log_model_1.ReminderLogModel.create({
                        meetingId: meeting.id,
                        userId,
                        reminderType: rule.type,
                        sentAt: now,
                    });
                }
            }
        }
    });
};
exports.startReminderScheduler = startReminderScheduler;
//# sourceMappingURL=reminderScheduler.js.map