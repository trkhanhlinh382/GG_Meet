import { Router } from "express";
import { z } from "zod";
import { requireAuth, type AuthRequest } from "../middleware/auth";
import { InvitationModel } from "../models/invitation.model";
import { MeetingModel } from "../models/meeting.model";

const createMeetingSchema = z.object({
  title: z.string().min(2),
  description: z.string().optional(),
  category: z.enum(["personal", "interview", "team_meeting", "client_meeting", "training"]),
  startTime: z.string(),
  endTime: z.string(),
  privacyMode: z.enum(["public", "private"]).default("private"),
  waitingRoomEnabled: z.boolean().default(true),
  password: z.string().optional(),
  participants: z.array(z.string()).optional(),
});

export const meetingRouter = Router();

meetingRouter.post("/", requireAuth, async (req: AuthRequest, res) => {
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

  const overlap = await MeetingModel.findOne({
    ownerId: userId,
    startTime: { $lt: endTime },
    endTime: { $gt: startTime },
    status: { $ne: "cancelled" },
  });

  if (overlap) {
    res.status(409).json({ message: "Meeting conflict detected" });
    return;
  }

  const meeting = await MeetingModel.create({
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
    await InvitationModel.insertMany(
      data.participants.map((participantId) => ({
        meetingId: meeting.id,
        userId: participantId,
      })),
    );
  }

  res.status(201).json(meeting);
});

meetingRouter.get("/:id", requireAuth, async (req, res) => {
  const meeting = await MeetingModel.findById(req.params.id);

  if (!meeting) {
    res.status(404).json({ message: "Meeting not found" });
    return;
  }

  res.json(meeting);
});

meetingRouter.post("/:id/join", requireAuth, async (req: AuthRequest, res) => {
  const meeting = await MeetingModel.findById(req.params.id);

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

meetingRouter.post("/:id/invite", requireAuth, async (req, res) => {
  const schema = z.object({ participantIds: z.array(z.string()).min(1) });
  const parseResult = schema.safeParse(req.body);

  if (!parseResult.success) {
    res.status(400).json({ message: "Invalid payload" });
    return;
  }

  const meeting = await MeetingModel.findById(req.params.id);
  if (!meeting) {
    res.status(404).json({ message: "Meeting not found" });
    return;
  }

  const invitations = await InvitationModel.insertMany(
    parseResult.data.participantIds.map((userId) => ({
      meetingId: meeting.id,
      userId,
    })),
  );

  res.status(201).json(invitations);
});
