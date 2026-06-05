import cors from "cors";
import express from "express";
import helmet from "helmet";
import morgan from "morgan";
import { env } from "./config/env";
import { authRouter } from "./routes/auth";
import { calendarRouter } from "./routes/calendar";
import { dashboardRouter } from "./routes/dashboard";
import { invitationRouter } from "./routes/invitations";
import { meetingDetailsRouter } from "./routes/meeting-details";
import { meetingRouter } from "./routes/meetings";
import { taskRouter } from "./routes/tasks";
import { notificationRouter } from "./routes/notifications";
import { adminRouter } from "./routes/admin";

export const app = express();

app.use(helmet());
app.use(
  cors({
    origin: env.CLIENT_URL,
    credentials: true,
  }),
);
app.use(express.json({ limit: "2mb" }));
app.use(morgan("dev"));

app.get("/api/health", (_req, res) => {
  res.json({ status: "ok" });
});

app.use("/api/auth", authRouter);
app.use("/api/dashboard", dashboardRouter);
app.use("/api/calendar", calendarRouter);
app.use("/api/meetings", meetingRouter);
app.use("/api/meetings", meetingDetailsRouter);
app.use("/api/invitations", invitationRouter);
app.use("/api/tasks", taskRouter);
app.use("/api/notifications", notificationRouter);
app.use("/api/admin", adminRouter);

