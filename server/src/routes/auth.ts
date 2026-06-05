import { OAuth2Client } from "google-auth-library";
import { Router } from "express";
import jwt from "jsonwebtoken";
import { z } from "zod";
import { env } from "../config/env";
import { UserModel } from "../models/user.model";

const googleAuthSchema = z.object({
  credential: z.string().min(10),
});

export const authRouter = Router();
const googleClient = new OAuth2Client(env.GOOGLE_CLIENT_ID || undefined);

authRouter.post("/google", async (req, res) => {
  if (!env.GOOGLE_CLIENT_ID) {
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
      audience: env.GOOGLE_CLIENT_ID,
    });
    payload = ticket.getPayload();
  } catch {
    res.status(401).json({ message: "Google token verification failed" });
    return;
  }

  if (!payload?.sub || !payload.email || !payload.name) {
    res.status(401).json({ message: "Invalid Google token payload" });
    return;
  }

  let user = await UserModel.findOne({ googleId: payload.sub });

  if (!user) {
    user = await UserModel.create({
      googleId: payload.sub,
      email: payload.email,
      fullName: payload.name,
      avatar: payload.picture,
      role: "host",
    });
  }

  const accessToken = jwt.sign(
    {
      id: user.id,
      email: user.email,
      fullName: user.fullName,
      role: user.role,
    },
    env.JWT_SECRET,
    { expiresIn: "1h" },
  );

  const refreshToken = jwt.sign({ id: user.id }, env.JWT_SECRET, { expiresIn: "7d" });

  res.json({
    accessToken,
    refreshToken,
    user,
  });
});

// Endpoint đăng nhập nhanh dành cho nhà phát triển / thử nghiệm di động
authRouter.post("/dev-login", async (req, res) => {
  const { email, fullName } = req.body;
  if (!email) {
    res.status(400).json({ message: "Email is required" });
    return;
  }

  let user = await UserModel.findOne({ email });

  if (!user) {
    user = await UserModel.create({
      googleId: `dev_${Date.now()}`,
      email,
      fullName: fullName || email.split("@")[0],
      role: "host",
    });
  }

  const accessToken = jwt.sign(
    {
      id: user.id,
      email: user.email,
      fullName: user.fullName,
      role: user.role,
    },
    env.JWT_SECRET,
    { expiresIn: "7d" } // Dành cho dev test: 7 ngày để đỡ hết hạn liên tục
  );

  res.json({
    accessToken,
    user,
  });
});

// Endpoint to toggle user role between admin and host for dev testing
authRouter.put("/dev-promote", async (req, res) => {
  const authHeader = req.headers.authorization;
  const token = authHeader?.startsWith("Bearer ") ? authHeader.slice(7) : undefined;

  if (!token) {
    res.status(401).json({ message: "Unauthorized" });
    return;
  }

  try {
    const payload = jwt.verify(token, env.JWT_SECRET) as { id: string };
    const user = await UserModel.findById(payload.id);

    if (!user) {
      res.status(404).json({ message: "User not found" });
      return;
    }

    // Toggle role: if admin, toggle to host; otherwise, elevate to admin
    const newRole = user.role === "admin" ? "host" : "admin";

    user.role = newRole;
    await user.save();

    const accessToken = jwt.sign(
      {
        id: user.id,
        email: user.email,
        fullName: user.fullName,
        role: user.role,
      },
      env.JWT_SECRET,
      { expiresIn: "7d" }
    );

    res.json({
      accessToken,
      user,
    });
  } catch {
    res.status(400).json({ message: "Invalid token or error promoting user" });
  }
});


