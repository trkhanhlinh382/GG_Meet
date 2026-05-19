"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.invitationRouter = void 0;
const express_1 = require("express");
const auth_1 = require("../middleware/auth");
const invitation_model_1 = require("../models/invitation.model");
exports.invitationRouter = (0, express_1.Router)();
exports.invitationRouter.post("/:id/accept", auth_1.requireAuth, async (req, res) => {
    const invitation = await invitation_model_1.InvitationModel.findByIdAndUpdate(req.params.id, { status: "accepted" }, { new: true });
    if (!invitation) {
        res.status(404).json({ message: "Invitation not found" });
        return;
    }
    res.json(invitation);
});
exports.invitationRouter.post("/:id/reject", auth_1.requireAuth, async (req, res) => {
    const invitation = await invitation_model_1.InvitationModel.findByIdAndUpdate(req.params.id, { status: "rejected" }, { new: true });
    if (!invitation) {
        res.status(404).json({ message: "Invitation not found" });
        return;
    }
    res.json(invitation);
});
exports.invitationRouter.post("/:id/maybe", auth_1.requireAuth, async (req, res) => {
    const invitation = await invitation_model_1.InvitationModel.findByIdAndUpdate(req.params.id, { status: "maybe" }, { new: true });
    if (!invitation) {
        res.status(404).json({ message: "Invitation not found" });
        return;
    }
    res.json(invitation);
});
//# sourceMappingURL=invitations.js.map