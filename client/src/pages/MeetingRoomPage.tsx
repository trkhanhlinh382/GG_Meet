import {
  AudioMutedOutlined,
  AudioOutlined,
  LockOutlined,
  MessageOutlined,
  StopOutlined,
  UnlockOutlined,
  UserSwitchOutlined,
  VideoCameraAddOutlined,
  VideoCameraOutlined,
} from "@ant-design/icons";
import { Alert, Button, Card, Col, Input, List, Row, Space, Switch, Tag, Typography, message } from "antd";
import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { io, type Socket } from "socket.io-client";
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
  const [locked, setLocked] = useState(false);
  const [participants, setParticipants] = useState<ParticipantState[]>([]);
  const [waitingParticipants, setWaitingParticipants] = useState<ParticipantState[]>([]);
  const [remoteStreams, setRemoteStreams] = useState<Record<string, MediaStream>>({});

  const isHostLike = isHost || isCoHost;

  const sortedMessages = useMemo(
    () => [...messages].sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()),
    [messages],
  );

  const createPeerConnection = (remoteSocketId: string, initiateOffer: boolean) => {
    if (!localStreamRef.current) {
      return;
    }

    if (peersRef.current.has(remoteSocketId)) {
      return;
    }

    const peer = new RTCPeerConnection(rtcConfig);

    localStreamRef.current.getTracks().forEach((track) => {
      peer.addTrack(track, localStreamRef.current as MediaStream);
    });

    peer.ontrack = (event) => {
      const [stream] = event.streams;
      setRemoteStreams((prev) => ({ ...prev, [remoteSocketId]: stream }));
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

  useEffect(() => {
    navigator.mediaDevices
      .getUserMedia({ video: true, audio: true })
      .then((stream) => {
        localStreamRef.current = stream;
        if (localVideoRef.current) {
          localVideoRef.current.srcObject = stream;
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

    socket.on("meeting:join-approved", ({ isHost: host, isCoHost: coHost, participants: existingParticipants, locked: roomLocked }) => {
      setWaitingRoom(false);
      setJoined(true);
      setIsHost(Boolean(host));
      setIsCoHost(Boolean(coHost));
      setLocked(Boolean(roomLocked));
      setParticipants(existingParticipants ?? []);

      for (const participant of existingParticipants ?? []) {
        createPeerConnection(participant.socketId, true);
      }
    });

    socket.on("meeting:join-denied", ({ reason }) => {
      message.error(reason ?? "Không thể tham gia room");
      navigate("/dashboard");
    });

    socket.on("meeting:participants-updated", (items: ParticipantState[]) => {
      setParticipants(items);
    });

    socket.on("meeting:waiting-updated", (items: ParticipantState[]) => {
      setWaitingParticipants(items);
    });

    socket.on("meeting:participant-joined", (participant: ParticipantState) => {
      createPeerConnection(participant.socketId, true);
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

    socket.on("meeting:room-locked", ({ locked: roomLocked }) => {
      setLocked(Boolean(roomLocked));
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

      peersRef.current.forEach((peer) => {
        const sender = peer.getSenders().find((item) => item.track?.kind === "video");
        sender?.replaceTrack(screenTrack);
      });

      screenTrack.onended = () => {
        const cameraTrack = localStreamRef.current?.getVideoTracks()[0];
        if (!cameraTrack) {
          return;
        }

        peersRef.current.forEach((peer) => {
          const sender = peer.getSenders().find((item) => item.track?.kind === "video");
          sender?.replaceTrack(cameraTrack);
        });
      };
    } catch {
      message.warning("Không thể chia sẻ màn hình");
    }
  };

  const toggleLock = (nextLocked: boolean) => {
    setLocked(nextLocked);
    socketRef.current?.emit("meeting:host-lock", {
      meetingId,
      actorUserId: user.id,
      locked: nextLocked,
    });
  };

  const endMeeting = () => {
    socketRef.current?.emit("meeting:host-end", {
      meetingId,
      actorUserId: user.id,
    });
  };

  if (waitingRoom) {
    return <Alert type="info" showIcon message="Bạn đang ở waiting room" description="Chờ host phê duyệt để vào phòng họp." />;
  }

  return (
    <Row gutter={[16, 16]}>
      <Col xs={24} lg={16}>
        <Card
          title={`Meeting Room: ${meetingId}`}
          extra={
            isHostLike ? (
              <Space>
                <Button icon={locked ? <UnlockOutlined /> : <LockOutlined />} onClick={() => toggleLock(!locked)}>
                  {locked ? "Unlock" : "Lock"}
                </Button>
                {isHost && (
                  <Button danger icon={<StopOutlined />} onClick={endMeeting}>
                    End Meeting
                  </Button>
                )}
              </Space>
            ) : null
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
                <Typography.Text strong>Participant</Typography.Text>
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

      <Col xs={24} lg={8}>
        <Card title="Participants">
          <List
            size="small"
            dataSource={participants}
            locale={{ emptyText: "Chưa có participant" }}
            renderItem={(participant) => (
              <List.Item
                actions={
                  isHostLike && participant.userId !== user.id
                    ? [
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
                        </Button>,
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
                        </Button>,
                      ]
                    : undefined
                }
              >
                <Space>
                  <Typography.Text>{participant.name}</Typography.Text>
                  <Tag color={participant.micOn ? "green" : "red"}>{participant.micOn ? "Mic" : "Muted"}</Tag>
                  <Tag color={participant.cameraOn ? "blue" : "default"}>{participant.cameraOn ? "Cam" : "Cam Off"}</Tag>
                </Space>
              </List.Item>
            )}
          />
        </Card>

        {isHostLike && (
          <Card title="Waiting Room" style={{ marginTop: 16 }}>
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
          </Card>
        )}

        <Card title="Realtime Chat" extra={<MessageOutlined />} style={{ marginTop: 16 }}>
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
            style={{ minHeight: 280 }}
          />
          <Input.Search value={text} onChange={(event) => setText(event.target.value)} onSearch={sendMessage} enterButton="Send" />
        </Card>
      </Col>
    </Row>
  );
};
