import { Router } from "express";
import { z } from "zod";
import { requireAuth } from "../middleware/auth";
import { TaskModel } from "../models/task.model";

const createTaskSchema = z.object({
  meetingId: z.string(),
  assigneeId: z.string(),
  title: z.string().min(2),
  deadline: z.string().optional(),
});

export const taskRouter = Router();

taskRouter.post("/", requireAuth, async (req, res) => {
  const parseResult = createTaskSchema.safeParse(req.body);

  if (!parseResult.success) {
    res.status(400).json({ message: "Invalid payload", errors: parseResult.error.flatten() });
    return;
  }

  const task = await TaskModel.create({
    meetingId: parseResult.data.meetingId,
    assigneeId: parseResult.data.assigneeId,
    title: parseResult.data.title,
    deadline: parseResult.data.deadline ? new Date(parseResult.data.deadline) : undefined,
  });

  res.status(201).json(task);
});
