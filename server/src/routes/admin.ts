import { Router, Response, NextFunction } from "express";
import { requireAuth, type AuthRequest } from "../middleware/auth";
import { UserModel } from "../models/user.model";
import { MeetingModel } from "../models/meeting.model";
import { InvitationModel } from "../models/invitation.model";

export const adminRouter = Router();

// Middleware to verify the user has admin role
const requireAdmin = (req: AuthRequest, res: Response, next: NextFunction): void => {
  if (!req.user) {
    res.status(401).json({ message: "Unauthorized" });
    return;
  }

  const role = req.user.role;
  if (role !== "admin") {
    res.status(403).json({ message: "Forbidden: Admin access required" });
    return;
  }


  next();
};

// GET /api/admin/stats - Retrieve system stats overview
adminRouter.get("/stats", requireAuth, requireAdmin, async (req: AuthRequest, res) => {
  try {
    const totalUsers = await UserModel.countDocuments();
    const totalMeetings = await MeetingModel.countDocuments();
    const totalInvitations = await InvitationModel.countDocuments();

    // Group users by their role
    const roleCounts = await UserModel.aggregate([
      { $group: { _id: "$role", count: { $sum: 1 } } },
    ]);

    const roles = roleCounts.reduce((acc: Record<string, number>, curr: { _id: string; count: number }) => {
      acc[curr._id] = curr.count;
      return acc;
    }, {});

    // Get 5 most recently registered users
    const recentUsers = await UserModel.find()
      .sort({ createdAt: -1 })
      .limit(5)
      .select("fullName email role avatar createdAt");

    // Count currently active/ongoing meetings
    const now = new Date();
    const activeMeetings = await MeetingModel.countDocuments({
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
  } catch (error) {
    res.status(500).json({ message: "Failed to fetch stats", error });
  }
});

// GET /api/admin/users - List users with query search, pagination, and role filters
adminRouter.get("/users", requireAuth, requireAdmin, async (req: AuthRequest, res) => {
  try {
    const search = req.query.search as string;
    const role = req.query.role as string;
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 10;
    const skip = (page - 1) * limit;

    const query: Record<string, any> = {};

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
      UserModel.find(query).sort({ createdAt: -1 }).skip(skip).limit(limit),
      UserModel.countDocuments(query),
    ]);

    res.json({
      users,
      total,
      page,
      limit,
    });
  } catch (error) {
    res.status(500).json({ message: "Failed to fetch users", error });
  }
});

// POST /api/admin/users - Manually create a user
adminRouter.post("/users", requireAuth, requireAdmin, async (req: AuthRequest, res) => {
  try {
    const { email, fullName, role, timezone, avatar } = req.body;

    if (!email || !fullName) {
      res.status(400).json({ message: "Email and fullName are required" });
      return;
    }

    const existingUser = await UserModel.findOne({ email });
    if (existingUser) {
      res.status(409).json({ message: "User with this email already exists" });
      return;
    }

    const user = await UserModel.create({
      googleId: `manual_${Date.now()}`,
      email,
      fullName,
      role: role || "host",
      timezone: timezone || "UTC",
      avatar: avatar || `https://api.dicebear.com/7.x/adventurer/svg?seed=${encodeURIComponent(fullName)}`,
    });


    res.status(201).json(user);
  } catch (error) {
    res.status(500).json({ message: "Failed to create user", error });
  }
});

// PUT /api/admin/users/:id - Update user details
adminRouter.put("/users/:id", requireAuth, requireAdmin, async (req: AuthRequest, res) => {
  try {
    const { id } = req.params;
    const { fullName, email, role, timezone, avatar } = req.body;

    const user = await UserModel.findById(id);
    if (!user) {
      res.status(404).json({ message: "User not found" });
      return;
    }

    if (fullName) user.fullName = fullName;
    if (email) {
      // Prevent changing to an email that is already used by another user
      const duplicate = await UserModel.findOne({ email, _id: { $ne: id } });
      if (duplicate) {
        res.status(409).json({ message: "Email already in use by another user" });
        return;
      }
      user.email = email;
    }

    if (role) user.role = role;
    if (timezone) user.timezone = timezone;
    if (avatar !== undefined) user.avatar = avatar;

    await user.save();
    res.json(user);
  } catch (error) {
    res.status(500).json({ message: "Failed to update user", error });
  }
});

// DELETE /api/admin/users/:id - Delete a user (cannot delete oneself)
adminRouter.delete("/users/:id", requireAuth, requireAdmin, async (req: AuthRequest, res) => {
  try {
    const { id } = req.params;

    if (id === req.user?.id) {
      res.status(400).json({ message: "You cannot delete your own account" });
      return;
    }

    const user = await UserModel.findByIdAndDelete(id);
    if (!user) {
      res.status(404).json({ message: "User not found" });
      return;
    }

    res.json({ message: "User deleted successfully", user });
  } catch (error) {
    res.status(500).json({ message: "Failed to delete user", error });
  }
});
