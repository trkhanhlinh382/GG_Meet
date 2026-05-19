import { Router } from "express";
import { z } from "zod";
import { requireAuth, type AuthRequest } from "../middleware/auth";
import { MeetingModel } from "../models/meeting.model";

const calendarQuerySchema = z.object({
  view: z.enum(["day", "week", "month"]).default("week"),
  date: z.string().optional(),
});

export const calendarRouter = Router();

const getWindow = (view: "day" | "week" | "month", date: Date): { start: Date; end: Date } => {
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

calendarRouter.get("/", requireAuth, async (req: AuthRequest, res) => {
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

  const meetings = await MeetingModel.find({
    ownerId: userId,
    startTime: { $gte: start, $lt: end },
    status: { $ne: "cancelled" },
  }).sort({ startTime: 1 });

  const enriched = meetings.map((meeting) => {
    const overlaps = meetings.filter(
      (candidate) =>
        candidate.id !== meeting.id &&
        candidate.startTime < meeting.endTime &&
        candidate.endTime > meeting.startTime,
    );

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
