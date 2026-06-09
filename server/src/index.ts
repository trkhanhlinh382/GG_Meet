import { createServer } from "node:http";
import { Server } from "socket.io";
import { app } from "./app";
import { env } from "./config/env";
import { connectDatabase } from "./db/connect";
import { startReminderScheduler } from "./jobs/reminderScheduler";
import { registerMeetingRealtime } from "./realtime/meetingRealtime";

const bootstrap = async (): Promise<void> => {
  await connectDatabase();

  const httpServer = createServer(app);
  const allowedOrigins = [env.CLIENT_URL, "http://localhost:8081", "http://localhost:19006"];
  const io = new Server(httpServer, {
    cors: {
      origin: (origin, callback) => {
        if (!origin) {
          callback(null, true);
          return;
        }
        const isAllowed = allowedOrigins.includes(origin) || origin.startsWith("http://localhost:") || origin.startsWith("http://127.0.0.1:");
        callback(null, isAllowed);
      },
      credentials: true,
    },
  });

  app.set("io", io);

  registerMeetingRealtime(io);
  startReminderScheduler();

  httpServer.listen(env.PORT, () => {
    // eslint-disable-next-line no-console
    console.log(`API listening on http://localhost:${env.PORT}`);
  });
};

bootstrap().catch((error) => {
  // eslint-disable-next-line no-console
  console.error("Failed to bootstrap server", error);
  process.exit(1);
});
