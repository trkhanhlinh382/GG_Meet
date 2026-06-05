"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.app = void 0;
const cors_1 = __importDefault(require("cors"));
const express_1 = __importDefault(require("express"));
const helmet_1 = __importDefault(require("helmet"));
const morgan_1 = __importDefault(require("morgan"));
const env_1 = require("./config/env");
const auth_1 = require("./routes/auth");
const calendar_1 = require("./routes/calendar");
const dashboard_1 = require("./routes/dashboard");
const invitations_1 = require("./routes/invitations");
const meeting_details_1 = require("./routes/meeting-details");
const meetings_1 = require("./routes/meetings");
const tasks_1 = require("./routes/tasks");
const notifications_1 = require("./routes/notifications");
const admin_1 = require("./routes/admin");
exports.app = (0, express_1.default)();
exports.app.use((0, helmet_1.default)());
exports.app.use((0, cors_1.default)({
    origin: env_1.env.CLIENT_URL,
    credentials: true,
}));
exports.app.use(express_1.default.json({ limit: "2mb" }));
exports.app.use((0, morgan_1.default)("dev"));
exports.app.get("/api/health", (_req, res) => {
    res.json({ status: "ok" });
});
exports.app.use("/api/auth", auth_1.authRouter);
exports.app.use("/api/dashboard", dashboard_1.dashboardRouter);
exports.app.use("/api/calendar", calendar_1.calendarRouter);
exports.app.use("/api/meetings", meetings_1.meetingRouter);
exports.app.use("/api/meetings", meeting_details_1.meetingDetailsRouter);
exports.app.use("/api/invitations", invitations_1.invitationRouter);
exports.app.use("/api/tasks", tasks_1.taskRouter);
exports.app.use("/api/notifications", notifications_1.notificationRouter);
exports.app.use("/api/admin", admin_1.adminRouter);
//# sourceMappingURL=app.js.map