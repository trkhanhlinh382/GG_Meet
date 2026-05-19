"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.UserModel = void 0;
const mongoose_1 = require("mongoose");
const userSchema = new mongoose_1.Schema({
    googleId: { type: String, required: true, unique: true },
    email: { type: String, required: true, unique: true },
    fullName: { type: String, required: true },
    avatar: { type: String },
    timezone: { type: String, default: "UTC" },
    role: {
        type: String,
        enum: ["personal", "freelancer", "team_member", "host", "manager", "admin", "super_admin"],
        default: "personal",
    },
}, { timestamps: true });
exports.UserModel = (0, mongoose_1.model)("User", userSchema);
//# sourceMappingURL=user.model.js.map