"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.registerMeetingRealtime = exports.closeRealtimeMeeting = exports.getMeetingRealtimeSnapshot = void 0;
const invitation_model_1 = require("../models/invitation.model");
const meeting_message_model_1 = require("../models/meeting-message.model");
const meeting_model_1 = require("../models/meeting.model");
const rooms = new Map();
const getMeetingRealtimeSnapshot = (meetingId) => {
    const state = rooms.get(meetingId);
    if (!state) {
        return null;
    }
    return {
        participants: Array.from(state.participants.values()),
        waiting: Array.from(state.waiting.values()),
        locked: state.locked,
    };
};
exports.getMeetingRealtimeSnapshot = getMeetingRealtimeSnapshot;
const closeRealtimeMeeting = (meetingId, io) => {
    io.to(meetingId).emit("meeting:ended");
    rooms.delete(meetingId);
    io.in(meetingId).socketsLeave(meetingId);
};
exports.closeRealtimeMeeting = closeRealtimeMeeting;
const getRoomState = (meetingId, hostUserId) => {
    const state = rooms.get(meetingId);
    if (state) {
        return state;
    }
    const created = {
        hostUserId,
        coHostUserIds: new Set(),
        locked: false,
        participants: new Map(),
        waiting: new Map(),
    };
    rooms.set(meetingId, created);
    return created;
};
const isHostLike = (state, userId) => {
    return state.hostUserId === userId || state.coHostUserIds.has(userId);
};
const registerMeetingRealtime = (io) => {
    io.on("connection", (socket) => {
        socket.on("meeting:request-join", async (payload) => {
            const { meetingId, userId, name } = payload;
            const meeting = await meeting_model_1.MeetingModel.findById(meetingId);
            if (!meeting) {
                socket.emit("meeting:join-denied", { reason: "Meeting not found" });
                return;
            }
            const hostUserId = meeting.ownerId.toString();
            const state = getRoomState(meetingId, hostUserId);
            const now = new Date();
            if (meeting.startTime > now) {
                socket.emit("meeting:not-started", {
                    meetingId,
                    startsAt: meeting.startTime,
                });
                return;
            }
            let hasAcceptedInvitation = false;
            const isHost = userId === hostUserId;
            if (meeting.privacyMode === "private" && !isHost) {
                const acceptedInvitation = await invitation_model_1.InvitationModel.findOne({
                    meetingId: meeting.id,
                    userId,
                    status: "accepted",
                });
                if (!acceptedInvitation) {
                    socket.emit("meeting:join-denied", {
                        reason: "Private meeting: only invited users with accepted invitation can join",
                    });
                    return;
                }
                hasAcceptedInvitation = true;
            }
            if (state.locked && !isHostLike(state, userId)) {
                socket.emit("meeting:join-denied", { reason: "Meeting is locked by host" });
                return;
            }
            const participant = {
                socketId: socket.id,
                userId,
                name,
                micOn: true,
                cameraOn: true,
            };
            // moved up for logic
            const isCoHost = state.coHostUserIds.has(userId);
            // Nếu đã accept invitation thì cho vào thẳng meeting, không vào phòng chờ
            if (meeting.waitingRoomEnabled &&
                !isHost &&
                !isCoHost &&
                !hasAcceptedInvitation) {
                state.waiting.set(socket.id, participant);
                socket.emit("meeting:waiting-room");
                io.to(meetingId).emit("meeting:waiting-updated", Array.from(state.waiting.values()));
                return;
            }
            socket.join(meetingId);
            state.participants.set(socket.id, participant);
            socket.emit("meeting:join-approved", {
                meetingId,
                isHost,
                isCoHost,
                locked: state.locked,
                participants: Array.from(state.participants.values()).filter((item) => item.socketId !== socket.id),
            });
            socket.to(meetingId).emit("meeting:participant-joined", participant);
            io.to(meetingId).emit("meeting:participants-updated", Array.from(state.participants.values()));
            io.to(meetingId).emit("meeting:waiting-updated", Array.from(state.waiting.values()));
        });
        socket.on("meeting:host-approve", (payload) => {
            const { meetingId, targetSocketId, actorUserId } = payload;
            const state = rooms.get(meetingId);
            if (!state || !isHostLike(state, actorUserId)) {
                return;
            }
            const target = state.waiting.get(targetSocketId);
            if (!target) {
                return;
            }
            state.waiting.delete(targetSocketId);
            state.participants.set(targetSocketId, target);
            const targetSocket = io.sockets.sockets.get(targetSocketId);
            targetSocket?.join(meetingId);
            targetSocket?.emit("meeting:join-approved", {
                meetingId,
                isHost: target.userId === state.hostUserId,
                isCoHost: state.coHostUserIds.has(target.userId),
                locked: state.locked,
                participants: Array.from(state.participants.values()).filter((item) => item.socketId !== targetSocketId),
            });
            socket.to(meetingId).emit("meeting:participant-joined", target);
            io.to(meetingId).emit("meeting:participants-updated", Array.from(state.participants.values()));
            io.to(meetingId).emit("meeting:waiting-updated", Array.from(state.waiting.values()));
        });
        socket.on("meeting:host-reject", (payload) => {
            const { meetingId, targetSocketId, actorUserId } = payload;
            const state = rooms.get(meetingId);
            if (!state || !isHostLike(state, actorUserId)) {
                return;
            }
            const target = state.waiting.get(targetSocketId);
            if (!target) {
                return;
            }
            state.waiting.delete(targetSocketId);
            const targetSocket = io.sockets.sockets.get(targetSocketId);
            targetSocket?.emit("meeting:join-denied", { reason: "Host rejected the request" });
            targetSocket?.disconnect(true);
            io.to(meetingId).emit("meeting:waiting-updated", Array.from(state.waiting.values()));
        });
        socket.on("meeting:host-lock", (payload) => {
            const { meetingId, actorUserId, locked } = payload;
            const state = rooms.get(meetingId);
            if (!state || !isHostLike(state, actorUserId)) {
                return;
            }
            state.locked = Boolean(locked);
            io.to(meetingId).emit("meeting:room-locked", { locked: state.locked });
        });
        socket.on("meeting:host-remove", (payload) => {
            const { meetingId, targetSocketId, actorUserId } = payload;
            const state = rooms.get(meetingId);
            if (!state || !isHostLike(state, actorUserId)) {
                return;
            }
            state.participants.delete(targetSocketId);
            const targetSocket = io.sockets.sockets.get(targetSocketId);
            targetSocket?.emit("meeting:removed", { reason: "Removed by host" });
            targetSocket?.leave(meetingId);
            io.to(meetingId).emit("meeting:participants-updated", Array.from(state.participants.values()));
            io.to(meetingId).emit("meeting:participant-left", { socketId: targetSocketId });
        });
        socket.on("meeting:host-assign-cohost", (payload) => {
            const { meetingId, targetSocketId, actorUserId } = payload;
            const state = rooms.get(meetingId);
            if (!state || !isHostLike(state, actorUserId)) {
                return;
            }
            const target = state.participants.get(targetSocketId);
            if (!target) {
                return;
            }
            state.coHostUserIds.add(target.userId);
            io.to(targetSocketId).emit("meeting:cohost-assigned");
        });
        socket.on("meeting:host-lower-hand", (payload) => {
            const { meetingId, targetSocketId, actorUserId } = payload;
            const state = rooms.get(meetingId);
            if (!state || !isHostLike(state, actorUserId)) {
                return;
            }
            const target = state.participants.get(targetSocketId);
            if (!target) {
                return;
            }
            target.raisedHand = false;
            target.raisedHandTime = undefined;
            io.to(targetSocketId).emit("meeting:hand-lowered");
            io.to(meetingId).emit("meeting:participants-updated", Array.from(state.participants.values()));
        });
        socket.on("meeting:host-end", (payload) => {
            const { meetingId, actorUserId } = payload;
            const state = rooms.get(meetingId);
            if (!state || !isHostLike(state, actorUserId)) {
                return;
            }
            void meeting_model_1.MeetingModel.findByIdAndUpdate(meetingId, {
                status: "ended",
                endTime: new Date(),
            })
                .catch(() => undefined)
                .finally(() => {
                io.to(meetingId).emit("meeting:ended");
                rooms.delete(meetingId);
                io.in(meetingId).socketsLeave(meetingId);
            });
        });
        socket.on("meeting:participant-state", (payload) => {
            const { meetingId, micOn, cameraOn, raisedHand, sharingScreen, screenStreamId } = payload;
            const state = rooms.get(meetingId);
            if (!state) {
                return;
            }
            const participant = state.participants.get(socket.id);
            if (!participant) {
                return;
            }
            participant.micOn = micOn;
            participant.cameraOn = cameraOn;
            if (typeof raisedHand === "boolean") {
                if (raisedHand && !participant.raisedHand) {
                    participant.raisedHandTime = new Date().toISOString();
                }
                participant.raisedHand = raisedHand;
            }
            if (typeof sharingScreen === "boolean") {
                participant.sharingScreen = sharingScreen;
            }
            if (screenStreamId !== undefined) {
                participant.screenStreamId = screenStreamId;
            }
            io.to(meetingId).emit("meeting:participants-updated", Array.from(state.participants.values()));
        });
        socket.on("meeting:chat", (payload) => {
            const { meetingId, userId, message, sender, fileData, fileName, fileType, sticker } = payload;
            const createdAt = new Date().toISOString();
            void meeting_message_model_1.MeetingMessageModel.create({
                meetingId,
                senderUserId: userId,
                senderName: sender,
                message,
                fileData,
                fileName,
                fileType,
                sticker,
                createdAt,
            }).catch(() => undefined);
            io.to(meetingId).emit("meeting:chat", {
                meetingId,
                message,
                sender,
                fileData,
                fileName,
                fileType,
                sticker,
                createdAt,
            });
        });
        socket.on("meeting:webrtc-offer", (payload) => {
            const { meetingId, toSocketId, offer, fromSocketId } = payload;
            io.to(toSocketId).emit("meeting:webrtc-offer", { meetingId, offer, fromSocketId });
        });
        socket.on("meeting:webrtc-answer", (payload) => {
            const { meetingId, toSocketId, answer, fromSocketId } = payload;
            io.to(toSocketId).emit("meeting:webrtc-answer", { meetingId, answer, fromSocketId });
        });
        socket.on("meeting:webrtc-ice", (payload) => {
            const { meetingId, toSocketId, candidate, fromSocketId } = payload;
            io.to(toSocketId).emit("meeting:webrtc-ice", { meetingId, candidate, fromSocketId });
        });
        socket.on("meeting:draw", (payload) => {
            const { meetingId } = payload;
            socket.to(meetingId).emit("meeting:draw", payload);
        });
        socket.on("disconnect", () => {
            for (const [meetingId, state] of rooms.entries()) {
                if (state.waiting.delete(socket.id)) {
                    io.to(meetingId).emit("meeting:waiting-updated", Array.from(state.waiting.values()));
                }
                const participant = state.participants.get(socket.id);
                if (!participant) {
                    continue;
                }
                state.participants.delete(socket.id);
                io.to(meetingId).emit("meeting:participant-left", { socketId: socket.id });
                io.to(meetingId).emit("meeting:participants-updated", Array.from(state.participants.values()));
                if (state.participants.size === 0) {
                    rooms.delete(meetingId);
                }
            }
        });
    });
};
exports.registerMeetingRealtime = registerMeetingRealtime;
//# sourceMappingURL=meetingRealtime.js.map