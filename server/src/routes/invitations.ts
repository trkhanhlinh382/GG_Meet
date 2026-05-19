import { Router } from "express";
import { requireAuth } from "../middleware/auth";
import { InvitationModel } from "../models/invitation.model";

export const invitationRouter = Router();

invitationRouter.post("/:id/accept", requireAuth, async (req, res) => {
  const invitation = await InvitationModel.findByIdAndUpdate(req.params.id, { status: "accepted" }, { new: true });

  if (!invitation) {
    res.status(404).json({ message: "Invitation not found" });
    return;
  }

  res.json(invitation);
});

invitationRouter.post("/:id/reject", requireAuth, async (req, res) => {
  const invitation = await InvitationModel.findByIdAndUpdate(req.params.id, { status: "rejected" }, { new: true });

  if (!invitation) {
    res.status(404).json({ message: "Invitation not found" });
    return;
  }

  res.json(invitation);
});

invitationRouter.post("/:id/maybe", requireAuth, async (req, res) => {
  const invitation = await InvitationModel.findByIdAndUpdate(req.params.id, { status: "maybe" }, { new: true });

  if (!invitation) {
    res.status(404).json({ message: "Invitation not found" });
    return;
  }

  res.json(invitation);
});
