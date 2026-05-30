"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const node_test_1 = require("node:test");
const node_assert_1 = __importDefault(require("node:assert"));
const env_1 = require("../config/env");
const meetings_1 = require("../routes/meetings");
(0, node_test_1.describe)("Environment Configuration Tests", () => {
    (0, node_test_1.test)("should parse NODE_ENV as an allowed enum value", () => {
        const allowedEnvs = ["development", "test", "production"];
        node_assert_1.default.ok(allowedEnvs.includes(env_1.env.NODE_ENV), `NODE_ENV '${env_1.env.NODE_ENV}' is not one of: ${allowedEnvs.join(", ")}`);
    });
    (0, node_test_1.test)("should parse PORT as a valid number", () => {
        node_assert_1.default.strictEqual(typeof env_1.env.PORT, "number");
        node_assert_1.default.ok(!isNaN(env_1.env.PORT), "PORT should not be NaN");
    });
    (0, node_test_1.test)("should have a valid MONGODB_URI string", () => {
        node_assert_1.default.strictEqual(typeof env_1.env.MONGODB_URI, "string");
        node_assert_1.default.ok(env_1.env.MONGODB_URI.length > 0, "MONGODB_URI should not be empty");
    });
    (0, node_test_1.test)("should have a valid CLIENT_URL starting with http", () => {
        node_assert_1.default.strictEqual(typeof env_1.env.CLIENT_URL, "string");
        node_assert_1.default.ok(env_1.env.CLIENT_URL.startsWith("http"), "CLIENT_URL must be a valid URL starting with http");
    });
});
(0, node_test_1.describe)("Recurring Meetings Logic Tests", () => {
    (0, node_test_1.test)("should generate correct number of daily occurrences", () => {
        const start = new Date("2026-06-01T10:00:00Z");
        const end = new Date("2026-06-01T11:00:00Z");
        const limit = new Date("2026-06-05T23:59:59Z");
        const dates = (0, meetings_1.generateRecurringDates)(start, end, "daily", limit);
        node_assert_1.default.strictEqual(dates.length, 5);
        node_assert_1.default.strictEqual(dates[0].startTime.toISOString(), "2026-06-01T10:00:00.000Z");
        node_assert_1.default.strictEqual(dates[4].startTime.toISOString(), "2026-06-05T10:00:00.000Z");
    });
    (0, node_test_1.test)("should generate correct number of weekly occurrences", () => {
        const start = new Date("2026-06-01T10:00:00Z");
        const end = new Date("2026-06-01T11:00:00Z");
        const limit = new Date("2026-06-20T23:59:59Z");
        const dates = (0, meetings_1.generateRecurringDates)(start, end, "weekly", limit);
        node_assert_1.default.strictEqual(dates.length, 3);
        node_assert_1.default.strictEqual(dates[1].startTime.toISOString(), "2026-06-08T10:00:00.000Z");
    });
    (0, node_test_1.test)("should enforce maximum occurrences limit of 10", () => {
        const start = new Date("2026-06-01T10:00:00Z");
        const end = new Date("2026-06-01T11:00:00Z");
        const limit = new Date("2026-12-31T23:59:59Z");
        const dates = (0, meetings_1.generateRecurringDates)(start, end, "daily", limit);
        node_assert_1.default.strictEqual(dates.length, 10);
    });
});
//# sourceMappingURL=env.test.js.map