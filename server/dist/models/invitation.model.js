"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.InvitationModel = void 0;
const mongoose_1 = require("mongoose");
const invitationSchema = new mongoose_1.Schema({
    meetingId: { type: mongoose_1.Schema.Types.ObjectId, ref: "Meeting", required: true },
    userId: { type: mongoose_1.Schema.Types.ObjectId, ref: "User", required: true },
    status: { type: String, enum: ["pending", "accepted", "rejected", "maybe"], default: "pending" },
}, { timestamps: true });
exports.InvitationModel = (0, mongoose_1.model)("Invitation", invitationSchema);
//# sourceMappingURL=invitation.model.js.map