"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.MeetingMessageModel = void 0;
const mongoose_1 = require("mongoose");
const meetingMessageSchema = new mongoose_1.Schema({
    meetingId: { type: mongoose_1.Schema.Types.ObjectId, ref: "Meeting", required: true, index: true },
    senderUserId: { type: mongoose_1.Schema.Types.ObjectId, ref: "User" },
    senderName: { type: String, required: true },
    message: { type: String },
    fileData: { type: String },
    fileName: { type: String },
    fileType: { type: String },
    sticker: { type: String },
    isPinned: { type: Boolean, default: false },
    createdAt: { type: Date, default: Date.now },
}, { timestamps: false });
exports.MeetingMessageModel = (0, mongoose_1.model)("MeetingMessage", meetingMessageSchema);
//# sourceMappingURL=meeting-message.model.js.map