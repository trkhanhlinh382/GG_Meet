"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.authRouter = void 0;
const google_auth_library_1 = require("google-auth-library");
const express_1 = require("express");
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const zod_1 = require("zod");
const env_1 = require("../config/env");
const user_model_1 = require("../models/user.model");
const googleAuthSchema = zod_1.z.object({
    credential: zod_1.z.string().min(10),
});
exports.authRouter = (0, express_1.Router)();
const googleClient = new google_auth_library_1.OAuth2Client(env_1.env.GOOGLE_CLIENT_ID || undefined);
exports.authRouter.post("/google", async (req, res) => {
    if (!env_1.env.GOOGLE_CLIENT_ID) {
        res.status(500).json({ message: "GOOGLE_CLIENT_ID is not configured" });
        return;
    }
    const parseResult = googleAuthSchema.safeParse(req.body);
    if (!parseResult.success) {
        res.status(400).json({ message: "Invalid payload", errors: parseResult.error.flatten() });
        return;
    }
    let payload;
    try {
        const ticket = await googleClient.verifyIdToken({
            idToken: parseResult.data.credential,
            audience: env_1.env.GOOGLE_CLIENT_ID,
        });
        payload = ticket.getPayload();
    }
    catch {
        res.status(401).json({ message: "Google token verification failed" });
        return;
    }
    if (!payload?.sub || !payload.email || !payload.name) {
        res.status(401).json({ message: "Invalid Google token payload" });
        return;
    }
    let user = await user_model_1.UserModel.findOne({ googleId: payload.sub });
    if (!user) {
        user = await user_model_1.UserModel.create({
            googleId: payload.sub,
            email: payload.email,
            fullName: payload.name,
            avatar: payload.picture,
            role: "host",
        });
    }
    const accessToken = jsonwebtoken_1.default.sign({
        id: user.id,
        email: user.email,
        fullName: user.fullName,
        role: user.role,
    }, env_1.env.JWT_SECRET, { expiresIn: "1h" });
    const refreshToken = jsonwebtoken_1.default.sign({ id: user.id }, env_1.env.JWT_SECRET, { expiresIn: "7d" });
    res.json({
        accessToken,
        refreshToken,
        user,
    });
});
// Endpoint đăng nhập nhanh dành cho nhà phát triển / thử nghiệm di động
exports.authRouter.post("/dev-login", async (req, res) => {
    const { email, fullName } = req.body;
    if (!email) {
        res.status(400).json({ message: "Email is required" });
        return;
    }
    let user = await user_model_1.UserModel.findOne({ email });
    if (!user) {
        user = await user_model_1.UserModel.create({
            googleId: `dev_${Date.now()}`,
            email,
            fullName: fullName || email.split("@")[0],
            role: "host",
        });
    }
    const accessToken = jsonwebtoken_1.default.sign({
        id: user.id,
        email: user.email,
        fullName: user.fullName,
        role: user.role,
    }, env_1.env.JWT_SECRET, { expiresIn: "7d" } // Dành cho dev test: 7 ngày để đỡ hết hạn liên tục
    );
    res.json({
        accessToken,
        user,
    });
});
// Endpoint to toggle user role between admin and host for dev testing
exports.authRouter.put("/dev-promote", async (req, res) => {
    const authHeader = req.headers.authorization;
    const token = authHeader?.startsWith("Bearer ") ? authHeader.slice(7) : undefined;
    if (!token) {
        res.status(401).json({ message: "Unauthorized" });
        return;
    }
    try {
        const payload = jsonwebtoken_1.default.verify(token, env_1.env.JWT_SECRET);
        const user = await user_model_1.UserModel.findById(payload.id);
        if (!user) {
            res.status(404).json({ message: "User not found" });
            return;
        }
        // Toggle role: if admin/super_admin, toggle to host; otherwise, elevate to admin
        const newRole = (user.role === "admin" || user.role === "super_admin") ? "host" : "admin";
        user.role = newRole;
        await user.save();
        const accessToken = jsonwebtoken_1.default.sign({
            id: user.id,
            email: user.email,
            fullName: user.fullName,
            role: user.role,
        }, env_1.env.JWT_SECRET, { expiresIn: "7d" });
        res.json({
            accessToken,
            user,
        });
    }
    catch {
        res.status(400).json({ message: "Invalid token or error promoting user" });
    }
});
//# sourceMappingURL=auth.js.map