"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.env = void 0;
const dotenv_1 = __importDefault(require("dotenv"));
const zod_1 = require("zod");
dotenv_1.default.config();
const envSchema = zod_1.z.object({
    NODE_ENV: zod_1.z.enum(["development", "test", "production"]).default("development"),
    PORT: zod_1.z.coerce.number().default(4000),
    MONGODB_URI: zod_1.z.string().default("mongodb://localhost:27017/gg_meet"),
    JWT_SECRET: zod_1.z.string().default("change-me-in-production"),
    CLIENT_URL: zod_1.z.string().default("http://localhost:5173"),
    GOOGLE_CLIENT_ID: zod_1.z.string().default(""),
});
exports.env = envSchema.parse(process.env);
//# sourceMappingURL=env.js.map