import {
  AudioMutedOutlined,
  AudioOutlined,
  MessageOutlined,
  StopOutlined,
  UserSwitchOutlined,
  VideoCameraAddOutlined,
  VideoCameraOutlined,
} from "@ant-design/icons";
import { Alert, Button, Card, Col, Input, List, Row, Select, Space, Switch, Tag, Typography, message } from "antd";
import { RightOutlined, LeftOutlined } from "@ant-design/icons";
import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { io, type Socket } from "socket.io-client";
import { http } from "../api/http";
import type { ParticipantState } from "../api/types";

interface SessionUser {
  id: string;
  fullName: string;
  email: string;
}

interface MeetingRoomPageProps {
  token: string;
  user: SessionUser;
}

interface ChatMessage {
  id: string;
  sender: string;
  message: string;
  createdAt: string;
}

const rtcConfig: RTCConfiguration = {
  iceServers: [{ urls: "stun:stun.l.google.com:19302" }],
};

export const MeetingRoomPage = ({ token, user }: MeetingRoomPageProps) => {
  const { id } = useParams();
  const navigate = useNavigate();
  const meetingId = id ?? "live";

  const localVideoRef = useRef<HTMLVideoElement | null>(null);
  const socketRef = useRef<Socket | null>(null);
  const localStreamRef = useRef<MediaStream | null>(null);
  const peersRef = useRef<Map<string, RTCPeerConnection>>(new Map());

  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [text, setText] = useState("");
  const [micOn, setMicOn] = useState(true);
  const [cameraOn, setCameraOn] = useState(true);
  const [joined, setJoined] = useState(false);
  const [waitingRoom, setWaitingRoom] = useState(false);
  const [isHost, setIsHost] = useState(false);
  const [isCoHost, setIsCoHost] = useState(false);
  const [participants, setParticipants] = useState<ParticipantState[]>([]);
  const [waitingParticipants, setWaitingParticipants] = useState<ParticipantState[]>([]);
  const [sideCollapsed, setSideCollapsed] = useState(false);
  const handleSideCollapse = () => setSideCollapsed((prev) => !prev);
  const [remoteStreams, setRemoteStreams] = useState<Record<string, MediaStream>>({});
  const [startsAt, setStartsAt] = useState<string | null>(null);
  const [countdownMs, setCountdownMs] = useState(0);
  const [privacyMode, setPrivacyMode] = useState<"public" | "private">("private");
  const [updatingPrivacy, setUpdatingPrivacy] = useState(false);

  const isHostLike = isHost || isCoHost;

  const sortedMessages = useMemo(
    () => [...messages].sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()),
    [messages],
  );

  const createPeerConnection = (remoteSocketId: string, initiateOffer: boolean) => {
    if (remoteSocketId === socketRef.current?.id) {
      return;
    }

    if (peersRef.current.has(remoteSocketId)) {
      return;
    }

    const peer = new RTCPeerConnection(rtcConfig);

    const localStream = localStreamRef.current;
    if (localStream) {
      localStream.getTracks().forEach((track) => {
        peer.addTrack(track, localStream);
      });
    }

    peer.ontrack = (event) => {
      setRemoteStreams((prev) => {
        const current = prev[remoteSocketId] ?? new MediaStream();

        // Keep at most one video and one audio track for stable rendering.
        const sameKindTracks = current.getTracks().filter((track) => track.kind === event.track.kind);
        sameKindTracks.forEach((track) => current.removeTrack(track));
        current.addTrack(event.track);

        return { ...prev, [remoteSocketId]: current };
      });
    };

    peer.onicecandidate = (event) => {
      if (!event.candidate) {
        return;
      }

      socketRef.current?.emit("meeting:webrtc-ice", {
        meetingId,
        toSocketId: remoteSocketId,
        fromSocketId: socketRef.current.id,
        candidate: event.candidate,
      });
    };

    peersRef.current.set(remoteSocketId, peer);

    if (initiateOffer) {
      void peer.createOffer().then(async (offer) => {
        await peer.setLocalDescription(offer);
        socketRef.current?.emit("meeting:webrtc-offer", {
          meetingId,
          toSocketId: remoteSocketId,
          fromSocketId: socketRef.current?.id,
          offer,
        });
      });
    }
  };

  const renegotiatePeer = async (remoteSocketId: string) => {
    const peer = peersRef.current.get(remoteSocketId);
    if (!peer || peer.signalingState === "closed") {
      return;
    }

    const offer = await peer.createOffer();
    await peer.setLocalDescription(offer);

    socketRef.current?.emit("meeting:webrtc-offer", {
      meetingId,
      toSocketId: remoteSocketId,
      fromSocketId: socketRef.current?.id,
      offer,
    });
  };

  const ensureLocalTracksOnPeer = async (remoteSocketId: string) => {
    const peer = peersRef.current.get(remoteSocketId);
    const localStream = localStreamRef.current;
    if (!peer || !localStream) {
      return;
    }

    const senders = peer.getSenders();

    for (const track of localStream.getTracks()) {
      const existingSender = senders.find((sender) => sender.track?.kind === track.kind);
      if (existingSender) {
        await existingSender.replaceTrack(track);
      } else {
        peer.addTrack(track, localStream);
      }
    }
  };

  const switchOutgoingVideoTrack = async (remoteSocketId: string, nextTrack: MediaStreamTrack, sourceStream: MediaStream) => {
    const peer = peersRef.current.get(remoteSocketId);
    if (!peer) {
      return;
    }

    const sender = peer.getSenders().find((item) => item.track?.kind === "video");
    if (sender) {
      await sender.replaceTrack(nextTrack);
      return;
    }

    peer.addTrack(nextTrack, sourceStream);
  };

  useEffect(() => {
    http
      .get(`/meetings/${meetingId}`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      })
      .then((response) => {
        if (response.data?.privacyMode === "public" || response.data?.privacyMode === "private") {
          setPrivacyMode(response.data.privacyMode);
        }
      })
      .catch(() => undefined);

    navigator.mediaDevices
      .getUserMedia({ video: true, audio: true })
      .then((stream) => {
        localStreamRef.current = stream;
        if (localVideoRef.current) {
          localVideoRef.current.srcObject = stream;
        }

        // If peers already exist, publish camera/mic tracks immediately and renegotiate.
        for (const [remoteSocketId] of peersRef.current.entries()) {
          void ensureLocalTracksOnPeer(remoteSocketId).then(() => renegotiatePeer(remoteSocketId));
        }
      })
      .catch(() => {
        message.warning("Không truy cập được camera/microphone, meeting vẫn có thể dùng chat.");
      });

    const socket = io(import.meta.env.VITE_API_BASE_URL?.replace("/api", "") ?? "http://localhost:4000", {
      auth: { token },
      transports: ["websocket"],
    });

    socketRef.current = socket;

    socket.on("connect", () => {
      socket.emit("meeting:request-join", {
        meetingId,
        userId: user.id,
        name: user.fullName,
      });
    });

    socket.on("meeting:waiting-room", () => {
      setWaitingRoom(true);
      setJoined(false);
    });

    socket.on("meeting:not-started", ({ startsAt: nextStartsAt }) => {
      setStartsAt(new Date(nextStartsAt).toISOString());
      setJoined(false);
      setWaitingRoom(false);
    });

    socket.on("meeting:join-approved", ({ isHost: host, isCoHost: coHost, participants: existingParticipants }) => {
      setStartsAt(null);
      setWaitingRoom(false);
      setJoined(true);
      setIsHost(Boolean(host));
      setIsCoHost(Boolean(coHost));
      setParticipants((existingParticipants ?? []).filter((participant: ParticipantState) => participant.socketId !== socket.id));

      for (const participant of existingParticipants ?? []) {
        createPeerConnection(participant.socketId, true);
        void ensureLocalTracksOnPeer(participant.socketId).then(() => renegotiatePeer(participant.socketId));
      }
    });

    socket.on("meeting:join-denied", ({ reason }) => {
      message.error(reason ?? "Không thể tham gia room");
      navigate("/dashboard");
    });

    socket.on("meeting:participants-updated", (items: ParticipantState[]) => {
      setParticipants(items.filter((participant) => participant.socketId !== socket.id));
    });

    socket.on("meeting:waiting-updated", (items: ParticipantState[]) => {
      setWaitingParticipants(items);
    });

    socket.on("meeting:participant-joined", (participant: ParticipantState) => {
      if (participant.socketId === socket.id) {
        return;
      }

      // The newly joined user creates offers from join-approved; existing members wait for offer and answer.
      createPeerConnection(participant.socketId, false);
      void ensureLocalTracksOnPeer(participant.socketId);
    });

    socket.on("meeting:participant-left", ({ socketId }) => {
      const peer = peersRef.current.get(socketId);
      peer?.close();
      peersRef.current.delete(socketId);
      setRemoteStreams((prev) => {
        const next = { ...prev };
        delete next[socketId];
        return next;
      });
    });

    socket.on("meeting:cohost-assigned", () => {
      setIsCoHost(true);
      message.success("Bạn đã được assign làm co-host");
    });

    socket.on("meeting:removed", ({ reason }) => {
      message.warning(reason ?? "Bạn đã bị remove khỏi meeting");
      navigate("/dashboard");
    });

    socket.on("meeting:ended", () => {
      message.info("Meeting đã được kết thúc bởi host");
      navigate("/dashboard");
    });

    socket.on("meeting:chat", (payload) => {
      setMessages((prev) => [
        ...prev,
        {
          id: crypto.randomUUID(),
          sender: payload.sender,
          message: payload.message,
          createdAt: payload.createdAt,
        },
      ]);
    });

    socket.on("meeting:webrtc-offer", async ({ fromSocketId, offer }) => {
      createPeerConnection(fromSocketId, false);
      const peer = peersRef.current.get(fromSocketId);
      if (!peer) {
        return;
      }

      await peer.setRemoteDescription(new RTCSessionDescription(offer));
      const answer = await peer.createAnswer();
      await peer.setLocalDescription(answer);

      socket.emit("meeting:webrtc-answer", {
        meetingId,
        toSocketId: fromSocketId,
        fromSocketId: socket.id,
        answer,
      });
    });

    socket.on("meeting:webrtc-answer", async ({ fromSocketId, answer }) => {
      const peer = peersRef.current.get(fromSocketId);
      if (!peer) {
        return;
      }

      await peer.setRemoteDescription(new RTCSessionDescription(answer));
    });

    socket.on("meeting:webrtc-ice", async ({ fromSocketId, candidate }) => {
      const peer = peersRef.current.get(fromSocketId);
      if (!peer || !candidate) {
        return;
      }

      await peer.addIceCandidate(new RTCIceCandidate(candidate));
    });

    return () => {
      socket.disconnect();
      localStreamRef.current?.getTracks().forEach((track) => track.stop());
      peersRef.current.forEach((peer) => peer.close());
      peersRef.current.clear();
    };
  }, [meetingId, navigate, token, user.fullName, user.id]);

  useEffect(() => {
    if (!startsAt) {
      setCountdownMs(0);
      return;
    }

    const update = () => {
      const diff = new Date(startsAt).getTime() - Date.now();
      setCountdownMs(Math.max(0, diff));
    };

    update();
    const timer = window.setInterval(update, 1000);
    return () => window.clearInterval(timer);
  }, [startsAt]);

  useEffect(() => {
    if (!startsAt || countdownMs > 0 || joined || waitingRoom) {
      return;
    }

    socketRef.current?.emit("meeting:request-join", {
      meetingId,
      userId: user.id,
      name: user.fullName,
    });
  }, [countdownMs, joined, meetingId, startsAt, user.fullName, user.id, waitingRoom]);

  useEffect(() => {
    const validSocketIds = new Set(participants.map((item) => item.socketId));

    setRemoteStreams((prev) => {
      const next: Record<string, MediaStream> = {};
      for (const [socketId, stream] of Object.entries(prev)) {
        if (validSocketIds.has(socketId)) {
          next[socketId] = stream;
        }
      }
      return next;
    });
  }, [participants]);

  const participantNameBySocket = useMemo(() => {
    return new Map(participants.map((item) => [item.socketId, item.name]));
  }, [participants]);

  const sendMessage = () => {
    if (!text.trim()) {
      return;
    }

    socketRef.current?.emit("meeting:chat", {
      meetingId,
      sender: user.fullName,
      message: text,
    });

    setText("");
  };

  const toggleMic = (nextState: boolean) => {
    setMicOn(nextState);
    localStreamRef.current?.getAudioTracks().forEach((track) => {
      track.enabled = nextState;
    });

    socketRef.current?.emit("meeting:participant-state", {
      meetingId,
      micOn: nextState,
      cameraOn,
    });
  };

  const toggleCamera = (nextState: boolean) => {
    setCameraOn(nextState);
    localStreamRef.current?.getVideoTracks().forEach((track) => {
      track.enabled = nextState;
    });

    socketRef.current?.emit("meeting:participant-state", {
      meetingId,
      micOn,
      cameraOn: nextState,
    });
  };

  const shareScreen = async () => {
    try {
      const display = await navigator.mediaDevices.getDisplayMedia({ video: true });
      const screenTrack = display.getVideoTracks()[0];

      if (!screenTrack) {
        message.warning("Không tìm thấy track màn hình để chia sẻ");
        return;
      }

      if (localVideoRef.current) {
        localVideoRef.current.srcObject = display;
      }

      for (const [remoteSocketId] of peersRef.current.entries()) {
        await switchOutgoingVideoTrack(remoteSocketId, screenTrack, display);

        await renegotiatePeer(remoteSocketId);
      }

      screenTrack.onended = () => {
        const cameraTrack = localStreamRef.current?.getVideoTracks()[0];
        if (!cameraTrack) {
          return;
        }

        if (localVideoRef.current && localStreamRef.current) {
          localVideoRef.current.srcObject = localStreamRef.current;
        }

        for (const [remoteSocketId] of peersRef.current.entries()) {
          void switchOutgoingVideoTrack(remoteSocketId, cameraTrack, localStreamRef.current as MediaStream);

          void renegotiatePeer(remoteSocketId);
        }
      };
    } catch {
      message.warning("Không thể chia sẻ màn hình");
    }
  };

  const endMeeting = () => {
    socketRef.current?.emit("meeting:host-end", {
      meetingId,
      actorUserId: user.id,
    });
  };

  const leaveMeeting = () => {
    navigate("/dashboard");
  };

  const updatePrivacyMode = async (nextMode: "public" | "private") => {
    if (!isHost) {
      return;
    }

    const previous = privacyMode;
    setPrivacyMode(nextMode);
    setUpdatingPrivacy(true);

    try {
      await http.patch(
        `/meetings/${meetingId}/privacy`,
        { privacyMode: nextMode },
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        },
      );

      message.success(`Meeting switched to ${nextMode}`);
    } catch {
      setPrivacyMode(previous);
      message.error("Không cập nhật được quyền Public/Private");
    } finally {
      setUpdatingPrivacy(false);
    }
  };

  const formatCountdown = (totalMs: number): string => {
    const totalSec = Math.floor(totalMs / 1000);
    const hours = Math.floor(totalSec / 3600);
    const minutes = Math.floor((totalSec % 3600) / 60);
    const seconds = totalSec % 60;

    return [hours, minutes, seconds]
      .map((item) => item.toString().padStart(2, "0"))
      .join(":");
  };

  if (waitingRoom) {
    return <Alert type="info" showIcon message="Bạn đang ở waiting room" description="Chờ host phê duyệt để vào phòng họp." />;
  }

  if (startsAt && countdownMs > 0) {
    return (
      <Alert
        type="info"
        showIcon
        message="Cuộc họp chưa bắt đầu"
        description={`Thời gian còn lại: ${formatCountdown(countdownMs)} (bắt đầu lúc ${new Date(startsAt).toLocaleString()})`}
      />
    );
  }

  return (
    <Row gutter={[16, 16]}>
      <Col xs={24} lg={sideCollapsed ? 24 : 16}>
        <Card
          title={`Meeting Room: ${meetingId}`}
          extra={
            <Space>
              <Select
                value={privacyMode}
                disabled={!isHost}
                loading={updatingPrivacy}
                style={{ width: 120 }}
                options={[
                  { value: "private", label: "Private" },
                  { value: "public", label: "Public" },
                ]}
                onChange={(value) => void updatePrivacyMode(value as "public" | "private")}
              />
              {isHost && (
                <Button danger icon={<StopOutlined />} onClick={endMeeting}>
                  Cancel Meeting
                </Button>
              )}
              {!isHost && <Button onClick={leaveMeeting}>Leave Meeting</Button>}
            </Space>
          }
        >
          {!joined && <Alert type="warning" showIcon message="Đang kết nối room..." style={{ marginBottom: 12 }} />}

          <div className="video-grid">
            <div className="video-card">
              <Typography.Text strong>You ({user.fullName})</Typography.Text>
              <video ref={localVideoRef} autoPlay muted playsInline className="meeting-video" />
            </div>

            {Object.entries(remoteStreams).map(([socketId, stream]) => (
              <div className="video-card" key={socketId}>
                <Typography.Text strong>{participantNameBySocket.get(socketId) ?? "Participant"}</Typography.Text>
                <video
                  autoPlay
                  playsInline
                  className="meeting-video"
                  ref={(node) => {
                    if (node) {
                      node.srcObject = stream;
                    }
                  }}
                />
              </div>
            ))}
          </div>

          <Space style={{ marginTop: 16 }} wrap>
            <Switch checked={micOn} checkedChildren={<AudioOutlined />} unCheckedChildren={<AudioMutedOutlined />} onChange={toggleMic} />
            <Switch checked={cameraOn} checkedChildren={<VideoCameraOutlined />} unCheckedChildren={<VideoCameraAddOutlined />} onChange={toggleCamera} />
            <Button icon={<VideoCameraAddOutlined />} onClick={() => void shareScreen()}>
              Share Screen
            </Button>
          </Space>
        </Card>
      </Col>

      <Col xs={24} lg={8} style={{ display: sideCollapsed ? "none" : undefined }}>
        <div style={{ position: "relative", marginBottom: 16 }}>
          <Card
            title="Meeting Side Panel"
            extra={
              <Button
                type="text"
                icon={sideCollapsed ? <LeftOutlined /> : <RightOutlined />}
                onClick={handleSideCollapse}
                style={{ marginLeft: 8 }}
              />
            }
            style={{
              transition: "transform 0.3s cubic-bezier(.4,0,.2,1)",
              transform: sideCollapsed ? "translateX(100%)" : "none",
              position: "relative",
              zIndex: 2,
              minHeight: 600,
            }}
            bodyStyle={{ display: sideCollapsed ? "none" : undefined }}
          >
                  {/* Nút nổi khi panel đã thu nhỏ: mở lại panel và rời phòng */}
                  {sideCollapsed && (
                    <Button
                      type="primary"
                      shape="circle"
                      icon={<RightOutlined style={{ fontSize: 28 }} />}
                      onClick={handleSideCollapse}
                      style={{
                        position: "fixed",
                        top: "50%",
                        right: 0,
                        zIndex: 9999,
                        transform: "translateY(-50%)",
                        boxShadow: "0 2px 8px rgba(0,0,0,0.18)",
                        width: 56,
                        height: 56,
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        background: "#1677ff",
                        border: "none",
                      }}
                      size="large"
                    />
                  )}
            <div style={{ marginBottom: 16 }}>
              <Typography.Title level={5}>Participants</Typography.Title>
              <List
                size="small"
                dataSource={participants}
                locale={{ emptyText: "Chưa có participant" }}
                renderItem={(participant) => (
                  <List.Item>
                    <div style={{ display: "flex", flexDirection: "column", width: "100%" }}>
                      <Typography.Text strong>{participant.name}</Typography.Text>
                      <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 2 }}>
                        <Tag color={participant.micOn ? "green" : "red"}>{participant.micOn ? "Mic" : "Muted"}</Tag>
                        <Tag color={participant.cameraOn ? "blue" : "default"}>{participant.cameraOn ? "Cam" : "Cam Off"}</Tag>
                        {isHostLike && participant.userId !== user.id && (
                          <>
                            <Button
                              key="cohost"
                              size="small"
                              icon={<UserSwitchOutlined />}
                              onClick={() =>
                                socketRef.current?.emit("meeting:host-assign-cohost", {
                                  meetingId,
                                  actorUserId: user.id,
                                  targetSocketId: participant.socketId,
                                })
                              }
                            >
                              Co-host
                            </Button>
                            <Button
                              key="remove"
                              danger
                              size="small"
                              onClick={() =>
                                socketRef.current?.emit("meeting:host-remove", {
                                  meetingId,
                                  actorUserId: user.id,
                                  targetSocketId: participant.socketId,
                                })
                              }
                            >
                              Remove
                            </Button>
                          </>
                        )}
                      </div>
                    </div>
                  </List.Item>
                )}
              />
            </div>
            {isHostLike && (
              <div style={{ marginBottom: 16 }}>
                <Typography.Title level={5}>Waiting Room</Typography.Title>
                <List
                  size="small"
                  dataSource={waitingParticipants}
                  locale={{ emptyText: "Không có ai chờ" }}
                  renderItem={(participant) => (
                    <List.Item
                      actions={[
                        <Button
                          key="approve"
                          type="link"
                          onClick={() =>
                            socketRef.current?.emit("meeting:host-approve", {
                              meetingId,
                              actorUserId: user.id,
                              targetSocketId: participant.socketId,
                            })
                          }
                        >
                          Approve
                        </Button>,
                        <Button
                          key="reject"
                          danger
                          type="link"
                          onClick={() =>
                            socketRef.current?.emit("meeting:host-reject", {
                              meetingId,
                              actorUserId: user.id,
                              targetSocketId: participant.socketId,
                            })
                          }
                        >
                          Reject
                        </Button>,
                      ]}
                    >
                      <Typography.Text>{participant.name}</Typography.Text>
                    </List.Item>
                  )}
                />
              </div>
            )}
            <div>
              <Typography.Title level={5}>Realtime Chat</Typography.Title>
              <List
                size="small"
                dataSource={sortedMessages}
                locale={{ emptyText: "Chưa có tin nhắn" }}
                renderItem={(item) => (
                  <List.Item>
                    <Typography.Text strong>{item.sender}: </Typography.Text>
                    <Typography.Text>{item.message}</Typography.Text>
                  </List.Item>
                )}
                style={{ minHeight: 180 }}
              />
              <Input.Search value={text} onChange={(event) => setText(event.target.value)} onSearch={sendMessage} enterButton="Send" />
            </div>
          </Card>
        </div>
      </Col>
    </Row>
  );
};
