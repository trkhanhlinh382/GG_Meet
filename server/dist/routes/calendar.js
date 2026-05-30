"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.calendarRouter = void 0;
const express_1 = require("express");
const zod_1 = require("zod");
const auth_1 = require("../middleware/auth");
const invitation_model_1 = require("../models/invitation.model");
const meeting_model_1 = require("../models/meeting.model");
const calendarQuerySchema = zod_1.z.object({
    view: zod_1.z.enum(["day", "week", "month"]).default("week"),
    date: zod_1.z.string().optional(),
});
exports.calendarRouter = (0, express_1.Router)();
const getWindow = (view, date) => {
    const base = new Date(date);
    base.setHours(0, 0, 0, 0);
    if (view === "day") {
        const end = new Date(base);
        end.setDate(end.getDate() + 1);
        return { start: base, end };
    }
    if (view === "week") {
        const day = base.getDay();
        const shift = day === 0 ? -6 : 1 - day;
        const start = new Date(base);
        start.setDate(base.getDate() + shift);
        const end = new Date(start);
        end.setDate(start.getDate() + 7);
        return { start, end };
    }
    const start = new Date(base.getFullYear(), base.getMonth(), 1);
    const end = new Date(base.getFullYear(), base.getMonth() + 1, 1);
    return { start, end };
};
exports.calendarRouter.get("/", auth_1.requireAuth, async (req, res) => {
    const parseResult = calendarQuerySchema.safeParse(req.query);
    if (!parseResult.success) {
        res.status(400).json({ message: "Invalid query", errors: parseResult.error.flatten() });
        return;
    }
    const userId = req.user?.id;
    if (!userId) {
        res.status(401).json({ message: "Unauthorized" });
        return;
    }
    const requestedDate = parseResult.data.date ? new Date(parseResult.data.date) : new Date();
    const { start, end } = getWindow(parseResult.data.view, requestedDate);
    const acceptedInvitations = await invitation_model_1.InvitationModel.find({ userId, status: "accepted" }).select("meetingId").lean();
    const invitedMeetingIds = acceptedInvitations.map((invitation) => invitation.meetingId);
    const meetings = await meeting_model_1.MeetingModel.find({
        startTime: { $gte: start, $lt: end },
        status: { $ne: "cancelled" },
        $or: [{ ownerId: userId }, { _id: { $in: invitedMeetingIds } }],
    }).populate({ path: "ownerId", select: "fullName email" }).sort({ startTime: 1 });
    const enriched = meetings.map((meeting) => {
        const overlaps = meetings.filter((candidate) => candidate.id !== meeting.id &&
            candidate.startTime < meeting.endTime &&
            candidate.endTime > meeting.startTime);
        return {
            ...meeting.toObject(),
            hasConflict: overlaps.length > 0,
            conflictCount: overlaps.length,
        };
    });
    res.json({
        view: parseResult.data.view,
        start,
        end,
        meetings: enriched,
    });
});
//# sourceMappingURL=calendar.js.map