"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const node_test_1 = require("node:test");
const node_assert_1 = __importDefault(require("node:assert"));
const node_http_1 = require("node:http");
const mongoose_1 = __importDefault(require("mongoose"));
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const app_1 = require("../app");
const env_1 = require("../config/env");
const user_model_1 = require("../models/user.model");
const meeting_model_1 = require("../models/meeting.model");
const invitation_model_1 = require("../models/invitation.model");
(0, node_test_1.describe)("Backend Use Cases Integration Tests", () => {
    let server;
    let baseUrl;
    let hostToken;
    let inviteeToken;
    let hostUser;
    let inviteeUser;
    let testMeetingId;
    let testInvitationId;
    (0, node_test_1.before)(async () => {
        // Connect to database
        if (mongoose_1.default.connection.readyState === 0) {
            await mongoose_1.default.connect(env_1.env.MONGODB_URI);
        }
        // Create unique test users
        const timestamp = Date.now();
        hostUser = await user_model_1.UserModel.create({
            fullName: `Test Host ${timestamp}`,
            email: `host_${timestamp}@example.com`,
            googleId: `google_host_${timestamp}`,
            role: "personal",
        });
        inviteeUser = await user_model_1.UserModel.create({
            fullName: `Test Invitee ${timestamp}`,
            email: `invitee_${timestamp}@example.com`,
            googleId: `google_invitee_${timestamp}`,
            role: "personal",
        });
        // Sign valid JWT tokens
        hostToken = jsonwebtoken_1.default.sign({ id: hostUser.id, email: hostUser.email, fullName: hostUser.fullName, role: hostUser.role }, env_1.env.JWT_SECRET);
        inviteeToken = jsonwebtoken_1.default.sign({ id: inviteeUser.id, email: inviteeUser.email, fullName: inviteeUser.fullName, role: inviteeUser.role }, env_1.env.JWT_SECRET);
        // Boot the Express application on a dynamic port
        server = (0, node_http_1.createServer)(app_1.app);
        await new Promise((resolve) => {
            server.listen(0, () => {
                const address = server.address();
                baseUrl = `http://localhost:${address.port}/api`;
                resolve();
            });
        });
    });
    (0, node_test_1.after)(async () => {
        // Clean up test records
        if (hostUser)
            await user_model_1.UserModel.deleteOne({ _id: hostUser._id });
        if (inviteeUser)
            await user_model_1.UserModel.deleteOne({ _id: inviteeUser._id });
        if (testMeetingId) {
            await meeting_model_1.MeetingModel.deleteOne({ _id: testMeetingId });
            await invitation_model_1.InvitationModel.deleteMany({ meetingId: testMeetingId });
        }
        // Shut down server and connection
        await new Promise((resolve) => server.close(() => resolve()));
        await mongoose_1.default.disconnect();
    });
    (0, node_test_1.test)("GET /health - should verify backend is healthy", async () => {
        const res = await fetch(`${baseUrl}/health`);
        node_assert_1.default.strictEqual(res.status, 200);
        const body = (await res.json());
        node_assert_1.default.strictEqual(body.status, "ok");
    });
    (0, node_test_1.test)("POST /meetings - should create a new meeting and generate a member invitation", async () => {
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
        node_assert_1.default.strictEqual(res.status, 201);
        const meeting = (await res.json());
        node_assert_1.default.strictEqual(meeting.title, "Integration Test Meeting Room");
        testMeetingId = meeting._id;
        // Verify invitation entry was created
        const inv = await invitation_model_1.InvitationModel.findOne({ meetingId: testMeetingId, userId: inviteeUser.id });
        node_assert_1.default.ok(inv, "Invitation should be created dynamically in the database");
        testInvitationId = inv.id;
    });
    (0, node_test_1.test)("GET /invitations/:id - should load invitation details successfully", async () => {
        const res = await fetch(`${baseUrl}/invitations/${testInvitationId}`, {
            headers: {
                Authorization: `Bearer ${inviteeToken}`,
            },
        });
        node_assert_1.default.strictEqual(res.status, 200);
        const inv = (await res.json());
        node_assert_1.default.strictEqual(inv._id, testInvitationId);
    });
    (0, node_test_1.test)("POST /invitations/:id/accept - should accept invitation successfully", async () => {
        const res = await fetch(`${baseUrl}/invitations/${testInvitationId}/accept`, {
            method: "POST",
            headers: {
                Authorization: `Bearer ${inviteeToken}`,
            },
        });
        node_assert_1.default.strictEqual(res.status, 200);
        const inv = (await res.json());
        node_assert_1.default.strictEqual(inv.status, "accepted");
        // Verify meeting contains invitee in participants list
        const meeting = await meeting_model_1.MeetingModel.findById(testMeetingId);
        node_assert_1.default.ok(meeting?.participants.map(String).includes(String(inviteeUser._id)));
    });
    (0, node_test_1.test)("POST /invitations/:id/reject - should reject invitation successfully", async () => {
        const res = await fetch(`${baseUrl}/invitations/${testInvitationId}/reject`, {
            method: "POST",
            headers: {
                Authorization: `Bearer ${inviteeToken}`,
            },
        });
        node_assert_1.default.strictEqual(res.status, 200);
        const inv = (await res.json());
        node_assert_1.default.strictEqual(inv.status, "rejected");
    });
    (0, node_test_1.test)("POST /meetings/:id/end - should transition meeting status to ended", async () => {
        const res = await fetch(`${baseUrl}/meetings/${testMeetingId}/end`, {
            method: "POST",
            headers: {
                Authorization: `Bearer ${hostToken}`,
            },
        });
        node_assert_1.default.strictEqual(res.status, 200);
        const body = (await res.json());
        node_assert_1.default.strictEqual(body.message, "Đã kết thúc cuộc họp thành công");
        node_assert_1.default.strictEqual(body.meeting.status, "ended");
    });
    (0, node_test_1.test)("DELETE /meetings/:id - should successfully cancel and remove meeting", async () => {
        const res = await fetch(`${baseUrl}/meetings/${testMeetingId}`, {
            method: "DELETE",
            headers: {
                Authorization: `Bearer ${hostToken}`,
            },
        });
        node_assert_1.default.strictEqual(res.status, 200);
        const body = (await res.json());
        node_assert_1.default.strictEqual(body.message, "Xóa cuộc họp thành công");
        // Verify meeting deleted
        const meeting = await meeting_model_1.MeetingModel.findById(testMeetingId);
        node_assert_1.default.strictEqual(meeting, null);
    });
});
//# sourceMappingURL=integration.test.js.map