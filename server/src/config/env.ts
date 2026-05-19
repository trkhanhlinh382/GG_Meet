import dotenv from "dotenv";
import { z } from "zod";

dotenv.config();

const envSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  PORT: z.coerce.number().default(4000),
  MONGODB_URI: z.string().default("mongodb://localhost:27017/gg_meet"),
  JWT_SECRET: z.string().default("change-me-in-production"),
  CLIENT_URL: z.string().default("http://localhost:5173"),
  GOOGLE_CLIENT_ID: z.string().default(""),
});

export const env = envSchema.parse(process.env);
