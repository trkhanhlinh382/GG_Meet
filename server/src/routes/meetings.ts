import { Router } from "express";
import { z } from "zod";
import { requireAuth, type AuthRequest } from "../middleware/auth";
import { InvitationModel } from "../models/invitation.model";
import { MeetingModel } from "../models/meeting.model";
import { UserModel } from "../models/user.model";

const createMeetingSchema = z.object({
  title: z.string().min(2),
  description: z.string().optional(),
  category: z.enum(["personal", "interview", "team_meeting", "client_meeting", "training"]),
  startTime: z.string(),
  endTime: z.string(),
  privacyMode: z.enum(["public", "private"]).default("private"),
  waitingRoomEnabled: z.boolean().default(true),
  recordingEnabled: z.boolean().default(false),
  recordingUrl: z.string().url().optional(),
  password: z.string().optional(),
  participants: z.array(z.string()).optional(),
});

const updatePrivacySchema = z.object({
  privacyMode: z.enum(["public", "private"]),
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
    recordingEnabled: data.recordingEnabled,
    recordingUrl: data.recordingUrl,
    password: data.password,
    participants: [userId], // Host luôn là participant
  });

  if (data.participants?.length) {
    // Không tạo invitation cho host
    const filteredParticipants = data.participants.filter((participantId) => participantId !== String(userId));
    if (filteredParticipants.length) {
      await InvitationModel.insertMany(
        filteredParticipants.map((participantId) => ({
          meetingId: meeting.id,
          userId: participantId,
        })),
      );
    }
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

  const userId = req.user?.id;
  if (!userId) {
    res.status(401).json({ message: "Unauthorized" });
    return;
  }

  const isOwner = meeting.ownerId.toString() === userId;

  if (meeting.privacyMode === "private" && !isOwner) {
    const invitation = await InvitationModel.findOne({
      meetingId: meeting.id,
      userId,
      status: "accepted",
    });

    if (!invitation) {
      res.status(403).json({
        message: "Private meeting: only invited users with accepted invitation can join",
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

meetingRouter.post("/:id/invite", requireAuth, async (req, res) => {
  const schema = z
    .object({
      participantIds: z.array(z.string()).optional(),
      participantEmails: z.array(z.string().email()).optional(),
    })
    .refine((value) => Boolean(value.participantIds?.length || value.participantEmails?.length), {
      message: "participantIds or participantEmails is required",
    });

  const parseResult = schema.safeParse(req.body);

  if (!parseResult.success) {
    res.status(400).json({ message: "Invalid payload" });
    return;
  }

  const userId = (req as AuthRequest).user?.id;
  if (!userId) {
    res.status(401).json({ message: "Unauthorized" });
    return;
  }

  const meeting = await MeetingModel.findById(req.params.id);
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

  let participantIdsFromEmails: string[] = [];
  if (participantEmails.length) {
    const users = await UserModel.find({ email: { $in: participantEmails } });
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

  const participantIds = Array.from(new Set([...participantIdsFromPayload, ...participantIdsFromEmails])).filter(
    (participantId) => participantId !== meeting.ownerId.toString(),
  );

  if (!participantIds.length) {
    res.status(400).json({ message: "No valid participant to invite" });
    return;
  }

  const invitations = await Promise.all(
    participantIds.map(async (participantId) => {
      return InvitationModel.findOneAndUpdate(
        { meetingId: meeting.id, userId: participantId },
        {
          $setOnInsert: {
            meetingId: meeting.id,
            userId: participantId,
            status: "pending",
          },
        },
        { new: true, upsert: true },
      );
    }),
  );

  res.status(201).json(invitations.filter(Boolean));
});

meetingRouter.patch("/:id/privacy", requireAuth, async (req: AuthRequest, res) => {
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

  const meeting = await MeetingModel.findById(req.params.id);
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
