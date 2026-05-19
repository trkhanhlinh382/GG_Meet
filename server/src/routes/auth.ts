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
