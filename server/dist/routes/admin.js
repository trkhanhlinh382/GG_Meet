"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.adminRouter = void 0;
const express_1 = require("express");
const auth_1 = require("../middleware/auth");
const user_model_1 = require("../models/user.model");
const meeting_model_1 = require("../models/meeting.model");
const invitation_model_1 = require("../models/invitation.model");
exports.adminRouter = (0, express_1.Router)();
// Middleware to verify the user has admin or super_admin role
const requireAdmin = (req, res, next) => {
    if (!req.user) {
        res.status(401).json({ message: "Unauthorized" });
        return;
    }
    const role = req.user.role;
    if (role !== "admin" && role !== "super_admin") {
        res.status(403).json({ message: "Forbidden: Admin access required" });
        return;
    }
    next();
};
// GET /api/admin/stats - Retrieve system stats overview
exports.adminRouter.get("/stats", auth_1.requireAuth, requireAdmin, async (req, res) => {
    try {
        const totalUsers = await user_model_1.UserModel.countDocuments();
        const totalMeetings = await meeting_model_1.MeetingModel.countDocuments();
        const totalInvitations = await invitation_model_1.InvitationModel.countDocuments();
        // Group users by their role
        const roleCounts = await user_model_1.UserModel.aggregate([
            { $group: { _id: "$role", count: { $sum: 1 } } },
        ]);
        const roles = roleCounts.reduce((acc, curr) => {
            acc[curr._id] = curr.count;
            return acc;
        }, {});
        // Get 5 most recently registered users
        const recentUsers = await user_model_1.UserModel.find()
            .sort({ createdAt: -1 })
            .limit(5)
            .select("fullName email role avatar createdAt");
        // Count currently active/ongoing meetings
        const now = new Date();
        const activeMeetings = await meeting_model_1.MeetingModel.countDocuments({
            startTime: { $lte: now },
            endTime: { $gte: now },
            status: { $ne: "cancelled" },
        });
        res.json({
            totalUsers,
            totalMeetings,
            totalInvitations,
            activeMeetings,
            roles,
            recentUsers,
        });
    }
    catch (error) {
        res.status(500).json({ message: "Failed to fetch stats", error });
    }
});
// GET /api/admin/users - List users with query search, pagination, and role filters
exports.adminRouter.get("/users", auth_1.requireAuth, requireAdmin, async (req, res) => {
    try {
        const search = req.query.search;
        const role = req.query.role;
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 10;
        const skip = (page - 1) * limit;
        const query = {};
        if (search) {
            query.$or = [
                { fullName: { $regex: search, $options: "i" } },
                { email: { $regex: search, $options: "i" } },
            ];
        }
        if (role) {
            query.role = role;
        }
        const [users, total] = await Promise.all([
            user_model_1.UserModel.find(query).sort({ createdAt: -1 }).skip(skip).limit(limit),
            user_model_1.UserModel.countDocuments(query),
        ]);
        res.json({
            users,
            total,
            page,
            limit,
        });
    }
    catch (error) {
        res.status(500).json({ message: "Failed to fetch users", error });
    }
});
// POST /api/admin/users - Manually create a user
exports.adminRouter.post("/users", auth_1.requireAuth, requireAdmin, async (req, res) => {
    try {
        const { email, fullName, role, timezone, avatar } = req.body;
        if (!email || !fullName) {
            res.status(400).json({ message: "Email and fullName are required" });
            return;
        }
        const existingUser = await user_model_1.UserModel.findOne({ email });
        if (existingUser) {
            res.status(409).json({ message: "User with this email already exists" });
            return;
        }
        const user = await user_model_1.UserModel.create({
            googleId: `manual_${Date.now()}`,
            email,
            fullName,
            role: role || "personal",
            timezone: timezone || "UTC",
            avatar: avatar || `https://api.dicebear.com/7.x/adventurer/svg?seed=${encodeURIComponent(fullName)}`,
        });
        res.status(201).json(user);
    }
    catch (error) {
        res.status(500).json({ message: "Failed to create user", error });
    }
});
// PUT /api/admin/users/:id - Update user details
exports.adminRouter.put("/users/:id", auth_1.requireAuth, requireAdmin, async (req, res) => {
    try {
        const { id } = req.params;
        const { fullName, email, role, timezone, avatar } = req.body;
        const user = await user_model_1.UserModel.findById(id);
        if (!user) {
            res.status(404).json({ message: "User not found" });
            return;
        }
        if (fullName)
            user.fullName = fullName;
        if (email) {
            // Prevent changing to an email that is already used by another user
            const duplicate = await user_model_1.UserModel.findOne({ email, _id: { $ne: id } });
            if (duplicate) {
                res.status(409).json({ message: "Email already in use by another user" });
                return;
            }
            user.email = email;
        }
        if (role)
            user.role = role;
        if (timezone)
            user.timezone = timezone;
        if (avatar !== undefined)
            user.avatar = avatar;
        await user.save();
        res.json(user);
    }
    catch (error) {
        res.status(500).json({ message: "Failed to update user", error });
    }
});
// DELETE /api/admin/users/:id - Delete a user (cannot delete oneself)
exports.adminRouter.delete("/users/:id", auth_1.requireAuth, requireAdmin, async (req, res) => {
    try {
        const { id } = req.params;
        if (id === req.user?.id) {
            res.status(400).json({ message: "You cannot delete your own account" });
            return;
        }
        const user = await user_model_1.UserModel.findByIdAndDelete(id);
        if (!user) {
            res.status(404).json({ message: "User not found" });
            return;
        }
        res.json({ message: "User deleted successfully", user });
    }
    catch (error) {
        res.status(500).json({ message: "Failed to delete user", error });
    }
});
//# sourceMappingURL=admin.js.map