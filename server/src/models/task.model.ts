import { Schema, Types, model } from "mongoose";

export type TaskStatus = "todo" | "in_progress" | "done";

interface Task {
  meetingId: Types.ObjectId;
  assigneeId: Types.ObjectId;
  title: string;
  deadline?: Date;
  status: TaskStatus;
}

const taskSchema = new Schema<Task>(
  {
    meetingId: { type: Schema.Types.ObjectId, ref: "Meeting", required: true },
    assigneeId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    title: { type: String, required: true },
    deadline: { type: Date },
    status: { type: String, enum: ["todo", "in_progress", "done"], default: "todo" },
  },
  { timestamps: true },
);

export const TaskModel = model<Task>("Task", taskSchema);
