"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.meetingRouter = void 0;
const express_1 = require("express");
const zod_1 = require("zod");
const auth_1 = require("../middleware/auth");
const invitation_model_1 = require("../models/invitation.model");
const meeting_model_1 = require("../models/meeting.model");
const createMeetingSchema = zod_1.z.object({
    title: zod_1.z.string().min(2),
    description: zod_1.z.string().optional(),
    category: zod_1.z.enum(["personal", "interview", "team_meeting", "client_meeting", "training"]),
    startTime: zod_1.z.string(),
    endTime: zod_1.z.string(),
    privacyMode: zod_1.z.enum(["public", "private"]).default("private"),
    waitingRoomEnabled: zod_1.z.boolean().default(true),
    password: zod_1.z.string().optional(),
    participants: zod_1.z.array(zod_1.z.string()).optional(),
});
exports.meetingRouter = (0, express_1.Router)();
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
    const startTime = new Date(data.startTime);
    const endTime = new Date(data.endTime);
    const overlap = await meeting_model_1.MeetingModel.findOne({
        ownerId: userId,
        startTime: { $lt: endTime },
        endTime: { $gt: startTime },
        status: { $ne: "cancelled" },
    });
    if (overlap) {
        res.status(409).json({ message: "Meeting conflict detected" });
        return;
    }
    const meeting = await meeting_model_1.MeetingModel.create({
        ownerId: userId,
        title: data.title,
        description: data.description,
        category: data.category,
        startTime,
        endTime,
        privacyMode: data.privacyMode,
        waitingRoomEnabled: data.waitingRoomEnabled,
        password: data.password,
    });
    if (data.participants?.length) {
        await invitation_model_1.InvitationModel.insertMany(data.participants.map((participantId) => ({
            meetingId: meeting.id,
            userId: participantId,
        })));
    }
    res.status(201).json(meeting);
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
    const now = new Date();
    if (meeting.startTime <= now && meeting.endTime >= now) {
        meeting.status = "live";
        await meeting.save();
    }
    res.json({ message: "Join success", meetingId: meeting.id, waitingRoomEnabled: meeting.waitingRoomEnabled });
});
exports.meetingRouter.post("/:id/invite", auth_1.requireAuth, async (req, res) => {
    const schema = zod_1.z.object({ participantIds: zod_1.z.array(zod_1.z.string()).min(1) });
    const parseResult = schema.safeParse(req.body);
    if (!parseResult.success) {
        res.status(400).json({ message: "Invalid payload" });
        return;
    }
    const meeting = await meeting_model_1.MeetingModel.findById(req.params.id);
    if (!meeting) {
        res.status(404).json({ message: "Meeting not found" });
        return;
    }
    const invitations = await invitation_model_1.InvitationModel.insertMany(parseResult.data.participantIds.map((userId) => ({
        meetingId: meeting.id,
        userId,
    })));
    res.status(201).json(invitations);
});
//# sourceMappingURL=meetings.js.map