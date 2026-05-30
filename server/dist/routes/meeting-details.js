"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.meetingDetailsRouter = void 0;
const express_1 = require("express");
const auth_1 = require("../middleware/auth");
const invitation_model_1 = require("../models/invitation.model");
const meeting_message_model_1 = require("../models/meeting-message.model");
const meeting_model_1 = require("../models/meeting.model");
const meetingRealtime_1 = require("../realtime/meetingRealtime");
exports.meetingDetailsRouter = (0, express_1.Router)();
exports.meetingDetailsRouter.get("/:id/details", auth_1.requireAuth, async (req, res) => {
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
    const meeting = await meeting_model_1.MeetingModel.findById(req.params.id).populate({ path: "ownerId", select: "fullName email" });
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
    }
    else {
        ownerId = meeting.ownerId.toString();
    }
    const isOwner = ownerId === userId;
    // Quyền truy cập: host hoặc participants
    const isParticipant = Array.isArray(meeting.participants)
        ? meeting.participants.map((id) => id.toString()).includes(userId)
        : false;
    if (!isOwner && !isParticipant) {
        res.status(403).json({ message: "Forbidden" });
        return;
    }
    const messages = await meeting_message_model_1.MeetingMessageModel.find({ meetingId: meeting.id }).sort({ createdAt: 1 }).limit(2000);
    const invitations = await invitation_model_1.InvitationModel.find({ meetingId: meeting.id })
        .populate("userId", "fullName email")
        .sort({ updatedAt: -1 })
        .limit(500);
    const realtimeSnapshot = (0, meetingRealtime_1.getMeetingRealtimeSnapshot)(meeting.id);
    const waitingRequests = isOwner ? realtimeSnapshot?.waiting ?? [] : [];
    res.json({
        meeting,
        messages,
        invitations,
        waitingRequests,
    });
});
//# sourceMappingURL=meeting-details.js.map