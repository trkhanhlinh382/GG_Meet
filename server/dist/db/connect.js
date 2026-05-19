"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.connectDatabase = void 0;
const mongoose_1 = __importDefault(require("mongoose"));
const env_1 = require("../config/env");
const connectDatabase = async () => {
    await mongoose_1.default.connect(env_1.env.MONGODB_URI);
};
exports.connectDatabase = connectDatabase;
//# sourceMappingURL=connect.js.map