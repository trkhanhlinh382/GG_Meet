"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.TaskModel = void 0;
const mongoose_1 = require("mongoose");
const taskSchema = new mongoose_1.Schema({
    meetingId: { type: mongoose_1.Schema.Types.ObjectId, ref: "Meeting", required: true },
    assigneeId: { type: mongoose_1.Schema.Types.ObjectId, ref: "User", required: true },
    title: { type: String, required: true },
    deadline: { type: Date },
    status: { type: String, enum: ["todo", "in_progress", "done"], default: "todo" },
}, { timestamps: true });
exports.TaskModel = (0, mongoose_1.model)("Task", taskSchema);
//# sourceMappingURL=task.model.js.map