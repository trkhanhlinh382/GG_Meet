import { Router } from "express";
import { requireAuth, type AuthRequest } from "../middleware/auth";
import { InvitationModel } from "../models/invitation.model";

export const invitationRouter = Router();

const meetingOwnerPopulate = { path: "ownerId", select: "fullName email" } as const;

const getInvitationUserId = (invitationUser: unknown): string | null => {
  if (!invitationUser) {
    return null;
  }

  if (typeof invitationUser === "string") {
    return invitationUser;
  }

  if (typeof invitationUser === "object" && invitationUser !== null) {
    const candidate = invitationUser as { _id?: { toString: () => string } | string; toString?: () => string };
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

const updateInvitationStatus = async (invitationId: string, userId: string, status: "accepted" | "rejected" | "maybe") => {
  const invitation = await InvitationModel.findById(invitationId);
  if (!invitation) {
    return { notFound: true as const };
  }

  if (invitation.userId.toString() !== userId) {
    return { forbidden: true as const };
  }

  invitation.status = status;
  await invitation.save();

  const populated = await InvitationModel.findById(invitation._id)
    .populate({ path: "meetingId", populate: meetingOwnerPopulate })
    .populate("userId", "fullName email");

  return { invitation: populated };
};

invitationRouter.get("/:id", requireAuth, async (req: AuthRequest, res) => {
  const userId = req.user?.id;
  if (!userId) {
    res.status(401).json({ message: "Unauthorized" });
    return;
  }

  const invitation = await InvitationModel.findById(req.params.id)
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

invitationRouter.post("/:id/accept", requireAuth, async (req: AuthRequest, res) => {
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

  res.json(result.invitation);
});

invitationRouter.post("/:id/reject", requireAuth, async (req: AuthRequest, res) => {
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

invitationRouter.post("/:id/maybe", requireAuth, async (req: AuthRequest, res) => {
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
