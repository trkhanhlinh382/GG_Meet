"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.taskRouter = void 0;
const express_1 = require("express");
const zod_1 = require("zod");
const auth_1 = require("../middleware/auth");
const task_model_1 = require("../models/task.model");
const createTaskSchema = zod_1.z.object({
    meetingId: zod_1.z.string(),
    assigneeId: zod_1.z.string(),
    title: zod_1.z.string().min(2),
    deadline: zod_1.z.string().optional(),
});
exports.taskRouter = (0, express_1.Router)();
exports.taskRouter.post("/", auth_1.requireAuth, async (req, res) => {
    const parseResult = createTaskSchema.safeParse(req.body);
    if (!parseResult.success) {
        res.status(400).json({ message: "Invalid payload", errors: parseResult.error.flatten() });
        return;
    }
    const task = await task_model_1.TaskModel.create({
        meetingId: parseResult.data.meetingId,
        assigneeId: parseResult.data.assigneeId,
        title: parseResult.data.title,
        deadline: parseResult.data.deadline ? new Date(parseResult.data.deadline) : undefined,
    });
    res.status(201).json(task);
});
//# sourceMappingURL=tasks.js.map