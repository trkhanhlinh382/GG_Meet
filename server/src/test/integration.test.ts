import { test, describe, before, after } from "node:test";
import assert from "node:assert";
import { createServer } from "node:http";
import mongoose from "mongoose";
import jwt from "jsonwebtoken";
import { app } from "../app";
import { env } from "../config/env";
import { UserModel } from "../models/user.model";
import { MeetingModel } from "../models/meeting.model";
import { InvitationModel } from "../models/invitation.model";

describe("Backend Use Cases Integration Tests", () => {
  let server: any;
  let baseUrl: string;
  let hostToken: string;
  let inviteeToken: string;
  let hostUser: any;
  let inviteeUser: any;
  let testMeetingId: string;
  let testInvitationId: string;

  before(async () => {
    // Connect to database
    if (mongoose.connection.readyState === 0) {
      await mongoose.connect(env.MONGODB_URI);
    }

    // Create unique test users
    const timestamp = Date.now();
    hostUser = await UserModel.create({
      fullName: `Test Host ${timestamp}`,
      email: `host_${timestamp}@example.com`,
      googleId: `google_host_${timestamp}`,
      role: "personal",
    });

    inviteeUser = await UserModel.create({
      fullName: `Test Invitee ${timestamp}`,
      email: `invitee_${timestamp}@example.com`,
      googleId: `google_invitee_${timestamp}`,
      role: "personal",
    });

    // Sign valid JWT tokens
    hostToken = jwt.sign(
      { id: hostUser.id, email: hostUser.email, fullName: hostUser.fullName, role: hostUser.role },
      env.JWT_SECRET
    );
    inviteeToken = jwt.sign(
      { id: inviteeUser.id, email: inviteeUser.email, fullName: inviteeUser.fullName, role: inviteeUser.role },
      env.JWT_SECRET
    );

    // Boot the Express application on a dynamic port
    server = createServer(app);
    await new Promise<void>((resolve) => {
      server.listen(0, () => {
        const address = server.address();
        baseUrl = `http://localhost:${address.port}/api`;
        resolve();
      });
    });
  });

  after(async () => {
    // Clean up test records
    if (hostUser) await UserModel.deleteOne({ _id: hostUser._id });
    if (inviteeUser) await UserModel.deleteOne({ _id: inviteeUser._id });
    if (testMeetingId) {
      await MeetingModel.deleteOne({ _id: testMeetingId });
      await InvitationModel.deleteMany({ meetingId: testMeetingId });
    }

    // Shut down server and connection
    await new Promise<void>((resolve) => server.close(() => resolve()));
    await mongoose.disconnect();
  });

  test("GET /health - should verify backend is healthy", async () => {
    const res = await fetch(`${baseUrl}/health`);
    assert.strictEqual(res.status, 200);
    const body = (await res.json()) as any;
    assert.strictEqual(body.status, "ok");
  });

  test("POST /meetings - should create a new meeting and generate a member invitation", async () => {
    const res = await fetch(`${baseUrl}/meetings`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${hostToken}`,
      },
      body: JSON.stringify({
        title: "Integration Test Meeting Room",
        description: "Testing invitation and meeting flow paths",
        category: "team_meeting",
        startTime: new Date(Date.now() + 30 * 60 * 1000).toISOString(),
        endTime: new Date(Date.now() + 90 * 60 * 1000).toISOString(),
        privacyMode: "private",
        waitingRoomEnabled: true,
        participants: [inviteeUser.id],
      }),
    });

    assert.strictEqual(res.status, 201);
    const meeting = (await res.json()) as any;
    assert.strictEqual(meeting.title, "Integration Test Meeting Room");
    testMeetingId = meeting._id;

    // Verify invitation entry was created
    const inv = await InvitationModel.findOne({ meetingId: testMeetingId, userId: inviteeUser.id });
    assert.ok(inv, "Invitation should be created dynamically in the database");
    testInvitationId = inv.id;
  });

  test("GET /invitations/:id - should load invitation details successfully", async () => {
    const res = await fetch(`${baseUrl}/invitations/${testInvitationId}`, {
      headers: {
        Authorization: `Bearer ${inviteeToken}`,
      },
    });
    assert.strictEqual(res.status, 200);
    const inv = (await res.json()) as any;
    assert.strictEqual(inv._id, testInvitationId);
  });

  test("POST /invitations/:id/accept - should accept invitation successfully", async () => {
    const res = await fetch(`${baseUrl}/invitations/${testInvitationId}/accept`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${inviteeToken}`,
      },
    });
    assert.strictEqual(res.status, 200);
    const inv = (await res.json()) as any;
    assert.strictEqual(inv.status, "accepted");

    // Verify meeting contains invitee in participants list
    const meeting = await MeetingModel.findById(testMeetingId);
    assert.ok(meeting?.participants.map(String).includes(String(inviteeUser._id)));
  });

  test("POST /invitations/:id/reject - should reject invitation successfully", async () => {
    const res = await fetch(`${baseUrl}/invitations/${testInvitationId}/reject`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${inviteeToken}`,
      },
    });
    assert.strictEqual(res.status, 200);
    const inv = (await res.json()) as any;
    assert.strictEqual(inv.status, "rejected");
  });

  test("POST /meetings/:id/end - should transition meeting status to ended", async () => {
    const res = await fetch(`${baseUrl}/meetings/${testMeetingId}/end`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${hostToken}`,
      },
    });
    assert.strictEqual(res.status, 200);
    const body = (await res.json()) as any;
    assert.strictEqual(body.message, "Đã kết thúc cuộc họp thành công");
    assert.strictEqual(body.meeting.status, "ended");
  });

  test("DELETE /meetings/:id - should successfully cancel and remove meeting", async () => {
    const res = await fetch(`${baseUrl}/meetings/${testMeetingId}`, {
      method: "DELETE",
      headers: {
        Authorization: `Bearer ${hostToken}`,
      },
    });
    assert.strictEqual(res.status, 200);
    const body = (await res.json()) as any;
    assert.strictEqual(body.message, "Xóa cuộc họp thành công");

    // Verify meeting deleted
    const meeting = await MeetingModel.findById(testMeetingId);
    assert.strictEqual(meeting, null);
  });
});
