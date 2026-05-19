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
  const io = new Server(httpServer, {
    cors: {
      origin: env.CLIENT_URL,
      credentials: true,
    },
  });

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
