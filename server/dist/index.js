"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const node_http_1 = require("node:http");
const socket_io_1 = require("socket.io");
const app_1 = require("./app");
const env_1 = require("./config/env");
const connect_1 = require("./db/connect");
const reminderScheduler_1 = require("./jobs/reminderScheduler");
const meetingRealtime_1 = require("./realtime/meetingRealtime");
const bootstrap = async () => {
    await (0, connect_1.connectDatabase)();
    const httpServer = (0, node_http_1.createServer)(app_1.app);
    const allowedOrigins = [env_1.env.CLIENT_URL, "http://localhost:8081", "http://localhost:19006"];
    const io = new socket_io_1.Server(httpServer, {
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
    app_1.app.set("io", io);
    (0, meetingRealtime_1.registerMeetingRealtime)(io);
    (0, reminderScheduler_1.startReminderScheduler)();
    httpServer.listen(env_1.env.PORT, () => {
        // eslint-disable-next-line no-console
        console.log(`API listening on http://localhost:${env_1.env.PORT}`);
    });
};
bootstrap().catch((error) => {
    // eslint-disable-next-line no-console
    console.error("Failed to bootstrap server", error);
    process.exit(1);
});
//# sourceMappingURL=index.js.map