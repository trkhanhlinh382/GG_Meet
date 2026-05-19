"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ReminderLogModel = void 0;
const mongoose_1 = require("mongoose");
const reminderLogSchema = new mongoose_1.Schema({
    meetingId: { type: mongoose_1.Schema.Types.ObjectId, ref: "Meeting", required: true },
    userId: { type: mongoose_1.Schema.Types.ObjectId, ref: "User", required: true },
    reminderType: {
        type: String,
        enum: ["one_day", "one_hour", "fifteen_minutes", "start"],
        required: true,
    },
    sentAt: { type: Date, default: Date.now },
}, { timestamps: true });
reminderLogSchema.index({ meetingId: 1, userId: 1, reminderType: 1 }, { unique: true });
exports.ReminderLogModel = (0, mongoose_1.model)("ReminderLog", reminderLogSchema);
//# sourceMappingURL=reminder-log.model.js.map