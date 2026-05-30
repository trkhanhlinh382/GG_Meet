"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.MeetingModel = void 0;
const mongoose_1 = require("mongoose");
const meetingSchema = new mongoose_1.Schema({
    ownerId: { type: mongoose_1.Schema.Types.ObjectId, ref: "User", required: true },
    title: { type: String, required: true },
    description: { type: String },
    category: {
        type: String,
        enum: ["personal", "interview", "team_meeting", "client_meeting", "training"],
        default: "team_meeting",
    },
    startTime: { type: Date, required: true },
    endTime: { type: Date, required: true },
    status: {
        type: String,
        enum: ["scheduled", "live", "ended", "cancelled"],
        default: "scheduled",
    },
    privacyMode: { type: String, enum: ["public", "private"], default: "private" },
    waitingRoomEnabled: { type: Boolean, default: true },
    recordingEnabled: { type: Boolean, default: false },
    recordingUrl: { type: String },
    password: { type: String },
    participants: [{ type: mongoose_1.Schema.Types.ObjectId, ref: "User" }],
    isRecurring: { type: Boolean, default: false },
    recurrence: {
        frequency: { type: String, enum: ["daily", "weekly", "monthly", "none"], default: "none" },
        endDate: { type: Date },
    },
}, { timestamps: true });
exports.MeetingModel = (0, mongoose_1.model)("Meeting", meetingSchema);
//# sourceMappingURL=meeting.model.js.map