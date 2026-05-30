import { Router } from "express";
import { z } from "zod";
import { requireAuth, type AuthRequest } from "../middleware/auth";
import { InvitationModel } from "../models/invitation.model";
import { MeetingModel } from "../models/meeting.model";
import { UserModel } from "../models/user.model";
import { sendMeetingEmailInvitation } from "../config/mailer";
import { MeetingMessageModel } from "../models/meeting-message.model";
import { closeRealtimeMeeting } from "../realtime/meetingRealtime";

const createMeetingSchema = z.object({
  title: z.string().min(2),
  description: z.string().optional(),
  category: z.enum(["personal", "interview", "team_meeting", "client_meeting", "training"]),
  startTime: z.string().optional(),
  endTime: z.string().optional(),
  privacyMode: z.enum(["public", "private"]).default("private"),
  waitingRoomEnabled: z.boolean().default(true),
  recordingEnabled: z.boolean().default(false),
  recordingUrl: z.string().url().optional(),
  password: z.string().optional(),
  participants: z.array(z.string()).optional(),
  isRecurring: z.boolean().optional().default(false),
  recurrence: z
    .object({
      frequency: z.enum(["daily", "weekly", "monthly", "none"]).default("none"),
      endDate: z.string().optional(),
    })
    .optional(),
  isInstant: z.boolean().optional().default(false),
});

const updatePrivacySchema = z.object({
  privacyMode: z.enum(["public", "private"]),
});

export const meetingRouter = Router();

export const generateRecurringDates = (start: Date, end: Date, frequency: "daily" | "weekly" | "monthly", limitDate: Date, maxOccurrences = 10) => {
  const dates: { startTime: Date; endTime: Date }[] = [];
  const duration = end.getTime() - start.getTime();

  const currentStart = new Date(start);
  let count = 0;

  while (currentStart <= limitDate && count < maxOccurrences) {
    const occurrenceStart = new Date(currentStart);
    const occurrenceEnd = new Date(occurrenceStart.getTime() + duration);
    dates.push({ startTime: occurrenceStart, endTime: occurrenceEnd });

    if (frequency === "daily") {
      currentStart.setDate(currentStart.getDate() + 1);
    } else if (frequency === "weekly") {
      currentStart.setDate(currentStart.getDate() + 7);
    } else if (frequency === "monthly") {
      currentStart.setMonth(currentStart.getMonth() + 1);
    }
    count++;
  }

  return dates;
};

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

  let startTime = data.startTime ? new Date(data.startTime) : new Date();
  let endTime = data.endTime ? new Date(data.endTime) : new Date(Date.now() + 60 * 60 * 1000); // 1 hour default

  if (data.isInstant) {
    startTime = new Date();
    endTime = new Date("2099-12-31T23:59:59.999Z"); // Represents infinite end time
  }

  let occurrences = [{ startTime, endTime }];

  if (!data.isInstant && data.isRecurring && data.recurrence && data.recurrence.frequency !== "none" && data.recurrence.endDate) {
    const limitDate = new Date(data.recurrence.endDate);
    occurrences = generateRecurringDates(startTime, endTime, data.recurrence.frequency as any, limitDate);
  }

  if (!data.isInstant) {
    const overlap = await MeetingModel.findOne({
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

  const createdMeetings: any[] = [];

  for (const occ of occurrences) {
    const meeting = await MeetingModel.create({
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
        await InvitationModel.insertMany(
          filteredParticipants.map((p) => ({
            meetingId: meeting.id,
            userId: p,
          })),
        );

        UserModel.find({ _id: { $in: filteredParticipants } }, "email")
          .then((users) => {
            users.forEach((u) => {
              if (u.email) {
                void sendMeetingEmailInvitation(u.email, data.title, occ.startTime, meeting.id);
              }
            });
          })
          .catch(() => undefined);
      }
    }
  }

  res.status(201).json(createdMeetings[0]);
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

const updateMeetingSchema = z.object({
  title: z.string().min(2).optional(),
  description: z.string().optional(),
  category: z.enum(["personal", "interview", "team_meeting", "client_meeting", "training"]).optional(),
  startTime: z.string().optional(),
  endTime: z.string().optional(),
  privacyMode: z.enum(["public", "private"]).optional(),
  waitingRoomEnabled: z.boolean().optional(),
  recordingEnabled: z.boolean().optional(),
  recordingUrl: z.string().url().optional(),
  password: z.string().optional(),
});

meetingRouter.put("/:id", requireAuth, async (req: AuthRequest, res) => {
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

  const meeting = await MeetingModel.findById(req.params.id);
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
    const overlap = await MeetingModel.findOne({
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

  if (data.title !== undefined) meeting.title = data.title;
  if (data.description !== undefined) meeting.description = data.description;
  if (data.category !== undefined) meeting.category = data.category;
  meeting.startTime = nextStartTime;
  meeting.endTime = nextEndTime;
  if (data.privacyMode !== undefined) meeting.privacyMode = data.privacyMode;
  if (data.waitingRoomEnabled !== undefined) meeting.waitingRoomEnabled = data.waitingRoomEnabled;
  if (data.recordingEnabled !== undefined) meeting.recordingEnabled = data.recordingEnabled;
  if (data.recordingUrl !== undefined) meeting.recordingUrl = data.recordingUrl;
  if (data.password !== undefined) meeting.password = data.password;

  await meeting.save();

  res.json({
    message: "Cập nhật cuộc họp thành công",
    meeting,
  });
});

meetingRouter.post("/:id/messages", requireAuth, async (req: AuthRequest, res) => {
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

  const isOwner = meeting.ownerId.toString() === userId;
  const isParticipant = Array.isArray(meeting.participants)
    ? meeting.participants.map((id: any) => id.toString()).includes(userId)
    : false;
  const hasInvitation = await InvitationModel.exists({ meetingId: meeting.id, userId });

  if (!isOwner && !isParticipant && !hasInvitation) {
    res.status(403).json({ message: "Forbidden" });
    return;
  }

  const { message, fileData, fileName, fileType, sticker } = req.body;
  const messageStr = message?.trim();

  if (!messageStr && !fileData && !sticker) {
    res.status(400).json({ message: "Nội dung tin nhắn, file đính kèm hoặc nhãn dán không được để trống" });
    return;
  }

  const userRecord = await UserModel.findById(userId);
  const senderName = userRecord?.fullName || "User";

  const newMessage = await MeetingMessageModel.create({
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

meetingRouter.patch("/:id/messages/:messageId/pin", requireAuth, async (req: AuthRequest, res) => {
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

  const isOwner = meeting.ownerId.toString() === userId;
  const isParticipant = Array.isArray(meeting.participants)
    ? meeting.participants.map((id: any) => id.toString()).includes(userId)
    : false;
  const hasInvitation = await InvitationModel.exists({ meetingId: meeting.id, userId });

  if (!isOwner && !isParticipant && !hasInvitation) {
    res.status(403).json({ message: "Forbidden" });
    return;
  }

  const messageRecord = await MeetingMessageModel.findOne({ _id: req.params.messageId, meetingId: meeting.id });
  if (!messageRecord) {
    res.status(404).json({ message: "Message not found" });
    return;
  }

  messageRecord.isPinned = !messageRecord.isPinned;
  await messageRecord.save();

  res.json({ message: messageRecord.isPinned ? "Đã ghim tin nhắn" : "Đã bỏ ghim tin nhắn", chatMessage: messageRecord });
});

meetingRouter.post("/:id/end", requireAuth, async (req: AuthRequest, res) => {
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
    res.status(403).json({ message: "Only host can end the meeting" });
    return;
  }

  meeting.status = "ended";
  meeting.endTime = new Date();
  await meeting.save();

  const io = req.app.get("io");
  if (io) {
    closeRealtimeMeeting(meeting.id, io);
  }

  res.json({ message: "Đã kết thúc cuộc họp thành công", meeting });
});

meetingRouter.post("/:id/reopen", requireAuth, async (req: AuthRequest, res) => {
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

meetingRouter.delete("/:id", requireAuth, async (req: AuthRequest, res) => {
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
    res.status(403).json({ message: "Only host can delete the meeting" });
    return;
  }

  await MeetingModel.findByIdAndDelete(req.params.id);
  await InvitationModel.deleteMany({ meetingId: req.params.id });

  res.json({ message: "Xóa cuộc họp thành công" });
});

meetingRouter.delete("/:id/kick/:userId", requireAuth, async (req: AuthRequest, res) => {
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
    res.status(403).json({ message: "Only host can kick participants" });
    return;
  }

  const targetUserId = req.params.userId;
  meeting.participants = meeting.participants.filter((id) => id.toString() !== targetUserId);
  await meeting.save();

  await InvitationModel.deleteMany({ meetingId: req.params.id, userId: targetUserId });

  res.json({ message: "Kick thành viên thành công" });
});
