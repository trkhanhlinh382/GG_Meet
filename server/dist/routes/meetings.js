"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.generateRecurringDates = exports.meetingRouter = void 0;
const express_1 = require("express");
const zod_1 = require("zod");
const auth_1 = require("../middleware/auth");
const invitation_model_1 = require("../models/invitation.model");
const meeting_model_1 = require("../models/meeting.model");
const user_model_1 = require("../models/user.model");
const mailer_1 = require("../config/mailer");
const meeting_message_model_1 = require("../models/meeting-message.model");
const meetingRealtime_1 = require("../realtime/meetingRealtime");
const createMeetingSchema = zod_1.z.object({
    title: zod_1.z.string().min(2),
    description: zod_1.z.string().optional(),
    category: zod_1.z.enum(["personal", "interview", "team_meeting", "client_meeting", "training"]),
    startTime: zod_1.z.string().optional(),
    endTime: zod_1.z.string().optional(),
    privacyMode: zod_1.z.enum(["public", "private"]).default("private"),
    waitingRoomEnabled: zod_1.z.boolean().default(true),
    recordingEnabled: zod_1.z.boolean().default(false),
    recordingUrl: zod_1.z.string().url().optional(),
    password: zod_1.z.string().optional(),
    participants: zod_1.z.array(zod_1.z.string()).optional(),
    isRecurring: zod_1.z.boolean().optional().default(false),
    recurrence: zod_1.z
        .object({
        frequency: zod_1.z.enum(["daily", "weekly", "monthly", "none"]).default("none"),
        endDate: zod_1.z.string().optional(),
    })
        .optional(),
    isInstant: zod_1.z.boolean().optional().default(false),
});
const updatePrivacySchema = zod_1.z.object({
    privacyMode: zod_1.z.enum(["public", "private"]),
});
exports.meetingRouter = (0, express_1.Router)();
const generateRecurringDates = (start, end, frequency, limitDate, maxOccurrences = 10) => {
    const dates = [];
    const duration = end.getTime() - start.getTime();
    const currentStart = new Date(start);
    let count = 0;
    while (currentStart <= limitDate && count < maxOccurrences) {
        const occurrenceStart = new Date(currentStart);
        const occurrenceEnd = new Date(occurrenceStart.getTime() + duration);
        dates.push({ startTime: occurrenceStart, endTime: occurrenceEnd });
        if (frequency === "daily") {
            currentStart.setDate(currentStart.getDate() + 1);
        }
        else if (frequency === "weekly") {
            currentStart.setDate(currentStart.getDate() + 7);
        }
        else if (frequency === "monthly") {
            currentStart.setMonth(currentStart.getMonth() + 1);
        }
        count++;
    }
    return dates;
};
exports.generateRecurringDates = generateRecurringDates;
exports.meetingRouter.post("/", auth_1.requireAuth, async (req, res) => {
    const parseResult = createMeetingSchema.safeParse(req.body);
    if (!parseResult.success) {
        res.status(400).json({ message: "Invalid payload", errors: parseResult.error.flatten() });
        return;
    }
    const userId = req.user?.id;
    if (!userId) {
        res.status(401).json({ message: "Unauthorized" });
        return;
    }
    const data = parseResult.data;
    let startTime = data.startTime ? new Date(data.startTime) : new Date();
    let endTime = data.endTime ? new Date(data.endTime) : new Date(Date.now() + 60 * 60 * 1000); // 1 hour default
    if (data.isInstant) {
        startTime = new Date();
        endTime = new Date("2099-12-31T23:59:59.999Z"); // Represents infinite end time
    }
    let occurrences = [{ startTime, endTime }];
    if (!data.isInstant && data.isRecurring && data.recurrence && data.recurrence.frequency !== "none" && data.recurrence.endDate) {
        const limitDate = new Date(data.recurrence.endDate);
        occurrences = (0, exports.generateRecurringDates)(startTime, endTime, data.recurrence.frequency, limitDate);
    }
    if (!data.isInstant) {
        const overlap = await meeting_model_1.MeetingModel.findOne({
            ownerId: userId,
            startTime: { $lt: occurrences[0].endTime },
            endTime: { $gt: occurrences[0].startTime },
            status: { $ne: "cancelled" },
        });
        if (overlap) {
            res.status(409).json({ message: "Meeting conflict detected" });
            return;
        }
    }
    const createdMeetings = [];
    for (const occ of occurrences) {
        const meeting = await meeting_model_1.MeetingModel.create({
            ownerId: userId,
            title: data.title,
            description: data.description,
            category: data.category,
            startTime: occ.startTime,
            endTime: occ.endTime,
            privacyMode: data.isInstant ? "public" : data.privacyMode,
            waitingRoomEnabled: data.isInstant ? false : data.waitingRoomEnabled,
            recordingEnabled: data.recordingEnabled,
            recordingUrl: data.recordingUrl,
            password: data.password,
            participants: [userId],
            isRecurring: data.isInstant ? false : data.isRecurring,
            recurrence: data.isInstant ? undefined : data.recurrence,
        });
        createdMeetings.push(meeting);
        if (data.participants?.length) {
            const filteredParticipants = data.participants.filter((p) => p !== String(userId));
            if (filteredParticipants.length) {
                await invitation_model_1.InvitationModel.insertMany(filteredParticipants.map((p) => ({
                    meetingId: meeting.id,
                    userId: p,
                })));
                user_model_1.UserModel.find({ _id: { $in: filteredParticipants } }, "email")
                    .then((users) => {
                    users.forEach((u) => {
                        if (u.email) {
                            void (0, mailer_1.sendMeetingEmailInvitation)(u.email, data.title, occ.startTime, meeting.id);
                        }
                    });
                })
                    .catch(() => undefined);
            }
        }
    }
    res.status(201).json(createdMeetings[0]);
});
exports.meetingRouter.get("/:id", auth_1.requireAuth, async (req, res) => {
    const meeting = await meeting_model_1.MeetingModel.findById(req.params.id);
    if (!meeting) {
        res.status(404).json({ message: "Meeting not found" });
        return;
    }
    res.json(meeting);
});
exports.meetingRouter.post("/:id/join", auth_1.requireAuth, async (req, res) => {
    const meeting = await meeting_model_1.MeetingModel.findById(req.params.id);
    if (!meeting) {
        res.status(404).json({ message: "Meeting not found" });
        return;
    }
    const userId = req.user?.id;
    if (!userId) {
        res.status(401).json({ message: "Unauthorized" });
        return;
    }
    const isOwner = meeting.ownerId.toString() === userId;
    if (meeting.privacyMode === "private" && !isOwner) {
        const invitation = await invitation_model_1.InvitationModel.findOne({
            meetingId: meeting.id,
            userId,
        });
        if (!invitation) {
            res.status(403).json({
                message: "Đây là cuộc họp riêng tư, chỉ những người được mời mới có thể tham gia.",
            });
            return;
        }
        if (invitation.status !== "accepted") {
            res.status(403).json({
                message: "Bạn cần phản hồi và chấp nhận lời mời để tham gia cuộc họp này.",
                invitationId: invitation._id.toString(),
                invitationStatus: invitation.status,
            });
            return;
        }
    }
    const now = new Date();
    if (meeting.startTime > now) {
        res.json({
            message: "Meeting not started yet",
            meetingId: meeting.id,
            waitingRoomEnabled: meeting.waitingRoomEnabled,
            notStarted: true,
            startsAt: meeting.startTime,
        });
        return;
    }
    if (meeting.startTime <= now && meeting.endTime >= now) {
        meeting.status = "live";
        await meeting.save();
    }
    res.json({ message: "Join success", meetingId: meeting.id, waitingRoomEnabled: meeting.waitingRoomEnabled });
});
exports.meetingRouter.post("/:id/invite", auth_1.requireAuth, async (req, res) => {
    const schema = zod_1.z
        .object({
        participantIds: zod_1.z.array(zod_1.z.string()).optional(),
        participantEmails: zod_1.z.array(zod_1.z.string().email()).optional(),
    })
        .refine((value) => Boolean(value.participantIds?.length || value.participantEmails?.length), {
        message: "participantIds or participantEmails is required",
    });
    const parseResult = schema.safeParse(req.body);
    if (!parseResult.success) {
        res.status(400).json({ message: "Invalid payload" });
        return;
    }
    const userId = req.user?.id;
    if (!userId) {
        res.status(401).json({ message: "Unauthorized" });
        return;
    }
    const meeting = await meeting_model_1.MeetingModel.findById(req.params.id);
    if (!meeting) {
        res.status(404).json({ message: "Meeting not found" });
        return;
    }
    if (meeting.ownerId.toString() !== userId) {
        res.status(403).json({ message: "Only host can invite participants" });
        return;
    }
    const participantIdsFromPayload = parseResult.data.participantIds ?? [];
    const participantEmails = parseResult.data.participantEmails ?? [];
    let participantIdsFromEmails = [];
    if (participantEmails.length) {
        const users = await user_model_1.UserModel.find({ email: { $in: participantEmails } });
        participantIdsFromEmails = users.map((user) => user.id);
        const foundEmails = new Set(users.map((user) => user.email.toLowerCase()));
        const missingEmails = participantEmails.filter((email) => !foundEmails.has(email.toLowerCase()));
        if (missingEmails.length) {
            res.status(404).json({
                message: "Some emails were not found",
                missingEmails,
            });
            return;
        }
    }
    const participantIds = Array.from(new Set([...participantIdsFromPayload, ...participantIdsFromEmails])).filter((participantId) => participantId !== meeting.ownerId.toString());
    if (!participantIds.length) {
        res.status(400).json({ message: "No valid participant to invite" });
        return;
    }
    const invitations = await Promise.all(participantIds.map(async (participantId) => {
        return invitation_model_1.InvitationModel.findOneAndUpdate({ meetingId: meeting.id, userId: participantId }, {
            $setOnInsert: {
                meetingId: meeting.id,
                userId: participantId,
                status: "pending",
            },
        }, { new: true, upsert: true });
    }));
    res.status(201).json(invitations.filter(Boolean));
});
exports.meetingRouter.patch("/:id/privacy", auth_1.requireAuth, async (req, res) => {
    const parseResult = updatePrivacySchema.safeParse(req.body);
    if (!parseResult.success) {
        res.status(400).json({ message: "Invalid payload", errors: parseResult.error.flatten() });
        return;
    }
    const userId = req.user?.id;
    if (!userId) {
        res.status(401).json({ message: "Unauthorized" });
        return;
    }
    const meeting = await meeting_model_1.MeetingModel.findById(req.params.id);
    if (!meeting) {
        res.status(404).json({ message: "Meeting not found" });
        return;
    }
    if (meeting.ownerId.toString() !== userId) {
        res.status(403).json({ message: "Only host can update privacy mode" });
        return;
    }
    meeting.privacyMode = parseResult.data.privacyMode;
    await meeting.save();
    res.json({
        message: "Meeting privacy updated",
        meetingId: meeting.id,
        privacyMode: meeting.privacyMode,
    });
});
const updateMeetingSchema = zod_1.z.object({
    title: zod_1.z.string().min(2).optional(),
    description: zod_1.z.string().optional(),
    category: zod_1.z.enum(["personal", "interview", "team_meeting", "client_meeting", "training"]).optional(),
    startTime: zod_1.z.string().optional(),
    endTime: zod_1.z.string().optional(),
    privacyMode: zod_1.z.enum(["public", "private"]).optional(),
    waitingRoomEnabled: zod_1.z.boolean().optional(),
    recordingEnabled: zod_1.z.boolean().optional(),
    recordingUrl: zod_1.z.string().url().optional(),
    password: zod_1.z.string().optional(),
});
exports.meetingRouter.put("/:id", auth_1.requireAuth, async (req, res) => {
    const parseResult = updateMeetingSchema.safeParse(req.body);
    if (!parseResult.success) {
        res.status(400).json({ message: "Invalid payload", errors: parseResult.error.flatten() });
        return;
    }
    const userId = req.user?.id;
    if (!userId) {
        res.status(401).json({ message: "Unauthorized" });
        return;
    }
    const meeting = await meeting_model_1.MeetingModel.findById(req.params.id);
    if (!meeting) {
        res.status(404).json({ message: "Meeting not found" });
        return;
    }
    if (meeting.ownerId.toString() !== userId) {
        res.status(403).json({ message: "Only host can update meeting details" });
        return;
    }
    const data = parseResult.data;
    const nextStartTime = data.startTime ? new Date(data.startTime) : meeting.startTime;
    const nextEndTime = data.endTime ? new Date(data.endTime) : meeting.endTime;
    if (nextStartTime >= nextEndTime) {
        res.status(400).json({ message: "Thời gian kết thúc phải diễn ra sau thời gian bắt đầu" });
        return;
    }
    // Schedule conflict check if time changed
    if (data.startTime || data.endTime) {
        const overlap = await meeting_model_1.MeetingModel.findOne({
            _id: { $ne: meeting.id },
            ownerId: userId,
            startTime: { $lt: nextEndTime },
            endTime: { $gt: nextStartTime },
            status: { $ne: "cancelled" },
        });
        if (overlap) {
            res.status(409).json({ message: "Thời gian cập nhật bị trùng với một lịch họp khác của bạn." });
            return;
        }
    }
    if (data.title !== undefined)
        meeting.title = data.title;
    if (data.description !== undefined)
        meeting.description = data.description;
    if (data.category !== undefined)
        meeting.category = data.category;
    meeting.startTime = nextStartTime;
    meeting.endTime = nextEndTime;
    if (data.privacyMode !== undefined)
        meeting.privacyMode = data.privacyMode;
    if (data.waitingRoomEnabled !== undefined)
        meeting.waitingRoomEnabled = data.waitingRoomEnabled;
    if (data.recordingEnabled !== undefined)
        meeting.recordingEnabled = data.recordingEnabled;
    if (data.recordingUrl !== undefined)
        meeting.recordingUrl = data.recordingUrl;
    if (data.password !== undefined)
        meeting.password = data.password;
    await meeting.save();
    res.json({
        message: "Cập nhật cuộc họp thành công",
        meeting,
    });
});
exports.meetingRouter.post("/:id/messages", auth_1.requireAuth, async (req, res) => {
    const userId = req.user?.id;
    if (!userId) {
        res.status(401).json({ message: "Unauthorized" });
        return;
    }
    const meeting = await meeting_model_1.MeetingModel.findById(req.params.id);
    if (!meeting) {
        res.status(404).json({ message: "Meeting not found" });
        return;
    }
    const isOwner = meeting.ownerId.toString() === userId;
    const isParticipant = Array.isArray(meeting.participants)
        ? meeting.participants.map((id) => id.toString()).includes(userId)
        : false;
    if (!isOwner && !isParticipant) {
        res.status(403).json({ message: "Forbidden" });
        return;
    }
    const { message, fileData, fileName, fileType, sticker } = req.body;
    const messageStr = message?.trim();
    if (!messageStr && !fileData && !sticker) {
        res.status(400).json({ message: "Nội dung tin nhắn, file đính kèm hoặc nhãn dán không được để trống" });
        return;
    }
    const userRecord = await user_model_1.UserModel.findById(userId);
    const senderName = userRecord?.fullName || "User";
    const newMessage = await meeting_message_model_1.MeetingMessageModel.create({
        meetingId: meeting.id,
        senderName,
        message: messageStr,
        fileData,
        fileName,
        fileType,
        sticker,
        senderUserId: userId,
    });
    res.status(201).json({ message: "Gửi tin nhắn thành công", chatMessage: newMessage });
});
exports.meetingRouter.patch("/:id/messages/:messageId/pin", auth_1.requireAuth, async (req, res) => {
    const userId = req.user?.id;
    if (!userId) {
        res.status(401).json({ message: "Unauthorized" });
        return;
    }
    const meeting = await meeting_model_1.MeetingModel.findById(req.params.id);
    if (!meeting) {
        res.status(404).json({ message: "Meeting not found" });
        return;
    }
    const isOwner = meeting.ownerId.toString() === userId;
    const isParticipant = Array.isArray(meeting.participants)
        ? meeting.participants.map((id) => id.toString()).includes(userId)
        : false;
    if (!isOwner && !isParticipant) {
        res.status(403).json({ message: "Forbidden" });
        return;
    }
    const messageRecord = await meeting_message_model_1.MeetingMessageModel.findOne({ _id: req.params.messageId, meetingId: meeting.id });
    if (!messageRecord) {
        res.status(404).json({ message: "Message not found" });
        return;
    }
    messageRecord.isPinned = !messageRecord.isPinned;
    await messageRecord.save();
    res.json({ message: messageRecord.isPinned ? "Đã ghim tin nhắn" : "Đã bỏ ghim tin nhắn", chatMessage: messageRecord });
});
exports.meetingRouter.post("/:id/end", auth_1.requireAuth, async (req, res) => {
    const userId = req.user?.id;
    if (!userId) {
        res.status(401).json({ message: "Unauthorized" });
        return;
    }
    const meeting = await meeting_model_1.MeetingModel.findById(req.params.id);
    if (!meeting) {
        res.status(404).json({ message: "Meeting not found" });
        return;
    }
    if (meeting.ownerId.toString() !== userId) {
        res.status(403).json({ message: "Only host can end the meeting" });
        return;
    }
    meeting.status = "ended";
    meeting.endTime = new Date();
    await meeting.save();
    const io = req.app.get("io");
    if (io) {
        (0, meetingRealtime_1.closeRealtimeMeeting)(meeting.id, io);
    }
    res.json({ message: "Đã kết thúc cuộc họp thành công", meeting });
});
exports.meetingRouter.post("/:id/reopen", auth_1.requireAuth, async (req, res) => {
    const userId = req.user?.id;
    if (!userId) {
        res.status(401).json({ message: "Unauthorized" });
        return;
    }
    const meeting = await meeting_model_1.MeetingModel.findById(req.params.id);
    if (!meeting) {
        res.status(404).json({ message: "Meeting not found" });
        return;
    }
    if (meeting.ownerId.toString() !== userId) {
        res.status(403).json({ message: "Only host can reopen the meeting" });
        return;
    }
    meeting.status = "scheduled";
    const now = new Date();
    if (meeting.endTime < now) {
        meeting.startTime = now;
        meeting.endTime = new Date(now.getTime() + 60 * 60 * 1000); // 1 hour extension
    }
    await meeting.save();
    res.json({ message: "Mở lại cuộc họp thành công", meeting });
});
exports.meetingRouter.delete("/:id", auth_1.requireAuth, async (req, res) => {
    const userId = req.user?.id;
    if (!userId) {
        res.status(401).json({ message: "Unauthorized" });
        return;
    }
    const meeting = await meeting_model_1.MeetingModel.findById(req.params.id);
    if (!meeting) {
        res.status(404).json({ message: "Meeting not found" });
        return;
    }
    if (meeting.ownerId.toString() !== userId) {
        res.status(403).json({ message: "Only host can delete the meeting" });
        return;
    }
    await meeting_model_1.MeetingModel.findByIdAndDelete(req.params.id);
    await invitation_model_1.InvitationModel.deleteMany({ meetingId: req.params.id });
    res.json({ message: "Xóa cuộc họp thành công" });
});
exports.meetingRouter.delete("/:id/kick/:userId", auth_1.requireAuth, async (req, res) => {
    const userId = req.user?.id;
    if (!userId) {
        res.status(401).json({ message: "Unauthorized" });
        return;
    }
    const meeting = await meeting_model_1.MeetingModel.findById(req.params.id);
    if (!meeting) {
        res.status(404).json({ message: "Meeting not found" });
        return;
    }
    if (meeting.ownerId.toString() !== userId) {
        res.status(403).json({ message: "Only host can kick participants" });
        return;
    }
    const targetUserId = req.params.userId;
    meeting.participants = meeting.participants.filter((id) => id.toString() !== targetUserId);
    await meeting.save();
    await invitation_model_1.InvitationModel.deleteMany({ meetingId: req.params.id, userId: targetUserId });
    res.json({ message: "Kick thành viên thành công" });
});
//# sourceMappingURL=meetings.js.map