import { test, describe } from "node:test";
import assert from "node:assert";
import { env } from "../config/env";
import { generateRecurringDates } from "../routes/meetings";

describe("Environment Configuration Tests", () => {
  test("should parse NODE_ENV as an allowed enum value", () => {
    const allowedEnvs = ["development", "test", "production"];
    assert.ok(allowedEnvs.includes(env.NODE_ENV), `NODE_ENV '${env.NODE_ENV}' is not one of: ${allowedEnvs.join(", ")}`);
  });

  test("should parse PORT as a valid number", () => {
    assert.strictEqual(typeof env.PORT, "number");
    assert.ok(!isNaN(env.PORT), "PORT should not be NaN");
  });

  test("should have a valid MONGODB_URI string", () => {
    assert.strictEqual(typeof env.MONGODB_URI, "string");
    assert.ok(env.MONGODB_URI.length > 0, "MONGODB_URI should not be empty");
  });

  test("should have a valid CLIENT_URL starting with http", () => {
    assert.strictEqual(typeof env.CLIENT_URL, "string");
    assert.ok(env.CLIENT_URL.startsWith("http"), "CLIENT_URL must be a valid URL starting with http");
  });
});

describe("Recurring Meetings Logic Tests", () => {
  test("should generate correct number of daily occurrences", () => {
    const start = new Date("2026-06-01T10:00:00Z");
    const end = new Date("2026-06-01T11:00:00Z");
    const limit = new Date("2026-06-05T23:59:59Z");

    const dates = generateRecurringDates(start, end, "daily", limit);
    assert.strictEqual(dates.length, 5);
    assert.strictEqual(dates[0].startTime.toISOString(), "2026-06-01T10:00:00.000Z");
    assert.strictEqual(dates[4].startTime.toISOString(), "2026-06-05T10:00:00.000Z");
  });

  test("should generate correct number of weekly occurrences", () => {
    const start = new Date("2026-06-01T10:00:00Z");
    const end = new Date("2026-06-01T11:00:00Z");
    const limit = new Date("2026-06-20T23:59:59Z");

    const dates = generateRecurringDates(start, end, "weekly", limit);
    assert.strictEqual(dates.length, 3);
    assert.strictEqual(dates[1].startTime.toISOString(), "2026-06-08T10:00:00.000Z");
  });

  test("should enforce maximum occurrences limit of 10", () => {
    const start = new Date("2026-06-01T10:00:00Z");
    const end = new Date("2026-06-01T11:00:00Z");
    const limit = new Date("2026-12-31T23:59:59Z");

    const dates = generateRecurringDates(start, end, "daily", limit);
    assert.strictEqual(dates.length, 10);
  });
});
