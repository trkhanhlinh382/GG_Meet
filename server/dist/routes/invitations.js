"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.invitationRouter = void 0;
const express_1 = require("express");
const auth_1 = require("../middleware/auth");
const invitation_model_1 = require("../models/invitation.model");
exports.invitationRouter = (0, express_1.Router)();
const meetingOwnerPopulate = { path: "ownerId", select: "fullName email" };
const getInvitationUserId = (invitationUser) => {
    if (!invitationUser) {
        return null;
    }
    if (typeof invitationUser === "string") {
        return invitationUser;
    }
    if (typeof invitationUser === "object" && invitationUser !== null) {
        const candidate = invitationUser;
        if (candidate._id && typeof candidate._id === "object" && typeof candidate._id.toString === "function") {
            return candidate._id.toString();
        }
        if (typeof candidate._id === "string") {
            return candidate._id;
        }
        if (typeof candidate.toString === "function") {
            return candidate.toString();
        }
    }
    return null;
};
const updateInvitationStatus = async (invitationId, userId, status) => {
    const invitation = await invitation_model_1.InvitationModel.findById(invitationId);
    if (!invitation) {
        return { notFound: true };
    }
    if (invitation.userId.toString() !== userId) {
        return { forbidden: true };
    }
    invitation.status = status;
    await invitation.save();
    const populated = await invitation_model_1.InvitationModel.findById(invitation._id)
        .populate({ path: "meetingId", populate: meetingOwnerPopulate })
        .populate("userId", "fullName email");
    return { invitation: populated };
};
exports.invitationRouter.get("/:id", auth_1.requireAuth, async (req, res) => {
    const userId = req.user?.id;
    if (!userId) {
        res.status(401).json({ message: "Unauthorized" });
        return;
    }
    const invitation = await invitation_model_1.InvitationModel.findById(req.params.id)
        .populate({ path: "meetingId", populate: meetingOwnerPopulate })
        .populate("userId", "fullName email");
    if (!invitation) {
        res.status(404).json({ message: "Invitation not found" });
        return;
    }
    const invitationUserId = getInvitationUserId(invitation.userId);
    if (!invitationUserId || invitationUserId !== userId) {
        res.status(403).json({ message: "Forbidden" });
        return;
    }
    res.json(invitation);
});
exports.invitationRouter.post("/:id/accept", auth_1.requireAuth, async (req, res) => {
    const userId = req.user?.id;
    if (!userId) {
        res.status(401).json({ message: "Unauthorized" });
        return;
    }
    const result = await updateInvitationStatus(req.params.id, userId, "accepted");
    if ("notFound" in result) {
        res.status(404).json({ message: "Invitation not found" });
        return;
    }
    if ("forbidden" in result) {
        res.status(403).json({ message: "Forbidden" });
        return;
    }
    // Nếu accept, thêm user vào participants của meeting
    const meetingId = result.invitation?.meetingId?._id?.toString?.() || result.invitation?.meetingId?.toString?.();
    if (meetingId) {
        const MeetingModel = require("../models/meeting.model").MeetingModel;
        await MeetingModel.updateOne({ _id: meetingId }, { $addToSet: { participants: userId } });
    }
    res.json(result.invitation);
});
exports.invitationRouter.post("/:id/reject", auth_1.requireAuth, async (req, res) => {
    const userId = req.user?.id;
    if (!userId) {
        res.status(401).json({ message: "Unauthorized" });
        return;
    }
    const result = await updateInvitationStatus(req.params.id, userId, "rejected");
    if ("notFound" in result) {
        res.status(404).json({ message: "Invitation not found" });
        return;
    }
    if ("forbidden" in result) {
        res.status(403).json({ message: "Forbidden" });
        return;
    }
    res.json(result.invitation);
});
exports.invitationRouter.post("/:id/maybe", auth_1.requireAuth, async (req, res) => {
    const userId = req.user?.id;
    if (!userId) {
        res.status(401).json({ message: "Unauthorized" });
        return;
    }
    const result = await updateInvitationStatus(req.params.id, userId, "maybe");
    if ("notFound" in result) {
        res.status(404).json({ message: "Invitation not found" });
        return;
    }
    if ("forbidden" in result) {
        res.status(403).json({ message: "Forbidden" });
        return;
    }
    res.json(result.invitation);
});
//# sourceMappingURL=invitations.js.map