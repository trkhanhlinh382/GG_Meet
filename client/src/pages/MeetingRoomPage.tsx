import {
  AudioMutedOutlined,
  AudioOutlined,
  StopOutlined,
  UserSwitchOutlined,
  VideoCameraAddOutlined,
  VideoCameraOutlined,
} from "@ant-design/icons";
import { Alert, Button, Card, Col, Input, List, Row, Select, Space, Switch, Tag, Typography, message, Tabs, Popover, Avatar } from "antd";
import { RightOutlined, LeftOutlined } from "@ant-design/icons";
import { useEffect, useMemo, useRef, useState, useCallback } from "react";
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
  roomId?: string;
  isMinimized?: boolean;
  onMinimize?: () => void;
  onMaximize?: () => void;
  onLeave?: () => void;
}

interface ChatMessage {
  id: string;
  sender: string;
  message?: string;
  fileData?: string;
  fileName?: string;
  fileType?: string;
  sticker?: string;
  createdAt: string;
}

interface VideoFeed {
  id: string;
  type: "local" | "local-screen" | "remote" | "remote-screen" | "whiteboard";
  socketId: string;
  stream?: MediaStream;
  name: string;
  micOn?: boolean;
  cameraOn?: boolean;
  raisedHand?: boolean;
}

const rtcConfig: RTCConfiguration = {
  iceServers: [{ urls: "stun:stun.l.google.com:19302" }],
};

export const MeetingRoomPage = ({ token, user, roomId, isMinimized = false, onMinimize, onMaximize, onLeave }: MeetingRoomPageProps) => {
  const { id } = useParams();
  const navigate = useNavigate();
  const meetingId = roomId || id || "live";

  const socketRef = useRef<Socket | null>(null);
  const localStreamRef = useRef<MediaStream | null>(null);
  const peersRef = useRef<Map<string, RTCPeerConnection>>(new Map());
  const [activeLocalStream, setActiveLocalStream] = useState<MediaStream | null>(null);

  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [stickerPopoverOpen, setStickerPopoverOpen] = useState(false);
  const [text, setText] = useState("");
  const [micOn, setMicOn] = useState(true);
  const [cameraOn, setCameraOn] = useState(true);
  const [raisedHand, setRaisedHand] = useState(false);
  const [joined, setJoined] = useState(false);
  const [waitingRoom, setWaitingRoom] = useState(false);
  const [meetingData, setMeetingData] = useState<any>(null);
  const [isHost, setIsHost] = useState(false);
  const [isCoHost, setIsCoHost] = useState(false);
  const [participants, setParticipants] = useState<ParticipantState[]>([]);
  const [waitingParticipants, setWaitingParticipants] = useState<ParticipantState[]>([]);
  const [sideCollapsed, setSideCollapsed] = useState(false);
  const handleSideCollapse = () => setSideCollapsed((prev) => !prev);
  const [remoteStreams, setRemoteStreams] = useState<Record<string, MediaStream>>({});
  const [startsAt, setStartsAt] = useState<string | null>(null);
  const [countdownMs, setCountdownMs] = useState(0);
  const [showWhiteboard, setShowWhiteboard] = useState(false);
  const [brushColor, setBrushColor] = useState("#000000");
  const [brushSize, setBrushSize] = useState(4);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const isDrawingRef = useRef(false);
  const prevCoordsRef = useRef({ x: 0, y: 0 });
  const [isRecording, setIsRecording] = useState(false);
  const [layoutMode, setLayoutMode] = useState<"grid" | "focus">("grid");
  const [focusSocketId, setFocusSocketId] = useState<string | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const recordedChunksRef = useRef<Blob[]>([]);
  const recordingStreamRef = useRef<MediaStream | null>(null);
  const [isSharingScreen, setIsSharingScreen] = useState(false);
  const screenStreamRef = useRef<MediaStream | null>(null);
  const [remoteScreenStreams, setRemoteScreenStreams] = useState<Record<string, MediaStream>>({});
  const allRemoteStreamsRef = useRef<Map<string, Set<MediaStream>>>(new Map());
  const whiteboardCanvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = document.createElement("canvas");
    canvas.width = 800;
    canvas.height = 500;
    whiteboardCanvasRef.current = canvas;
  }, []);

  const isHostLike = isHost || isCoHost;

  const sortedMessages = useMemo(
    () => [...messages].sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()),
    [messages],
  );

  const updateRemoteStreamsFromCache = useCallback(() => {
    const nextRemoteStreams: Record<string, MediaStream> = {};
    const nextRemoteScreenStreams: Record<string, MediaStream> = {};

    for (const [socketId, streams] of allRemoteStreamsRef.current.entries()) {
      const participant = participants.find((p) => p.socketId === socketId);
      const screenStreamId = participant?.screenStreamId;

      if (streams.size === 1) {
        const stream = Array.from(streams)[0];
        if (screenStreamId && stream.id === screenStreamId) {
          nextRemoteScreenStreams[socketId] = stream;
        } else {
          nextRemoteStreams[socketId] = stream;
        }
      } else if (streams.size > 1) {
        let foundScreen = false;
        streams.forEach((stream) => {
          if (screenStreamId && stream.id === screenStreamId) {
            nextRemoteScreenStreams[socketId] = stream;
            foundScreen = true;
          }
        });

        streams.forEach((stream) => {
          if (screenStreamId && stream.id === screenStreamId) {
            return;
          }
          if (!foundScreen && !nextRemoteStreams[socketId]) {
            nextRemoteStreams[socketId] = stream;
          } else if (!foundScreen) {
            nextRemoteScreenStreams[socketId] = stream;
          } else {
            nextRemoteStreams[socketId] = stream;
          }
        });
      }
    }

    setRemoteStreams(nextRemoteStreams);
    setRemoteScreenStreams(nextRemoteScreenStreams);
  }, [participants]);

  useEffect(() => {
    const validSocketIds = new Set(participants.map((item) => item.socketId));

    for (const socketId of allRemoteStreamsRef.current.keys()) {
      if (!validSocketIds.has(socketId)) {
        allRemoteStreamsRef.current.delete(socketId);
      }
    }

    updateRemoteStreamsFromCache();
  }, [participants, updateRemoteStreamsFromCache]);

  const videoFeeds = useMemo(() => {
    const feeds: VideoFeed[] = [];

    if (activeLocalStream) {
      feeds.push({
        id: "local",
        type: "local",
        socketId: socketRef.current?.id || "local",
        stream: activeLocalStream,
        name: `You (${user.fullName})`,
        micOn,
        cameraOn,
        raisedHand,
      });
    }

    if (isSharingScreen && screenStreamRef.current) {
      feeds.push({
        id: "local-screen",
        type: "local-screen",
        socketId: socketRef.current?.id || "local",
        stream: screenStreamRef.current,
        name: `You (${user.fullName}) - Trình chiếu`,
        micOn: false,
        cameraOn: true,
      });
    }

    if (showWhiteboard) {
      feeds.push({
        id: "whiteboard",
        type: "whiteboard",
        socketId: socketRef.current?.id || "local",
        name: "Bảng vẽ chung",
        micOn: false,
        cameraOn: true,
      });
    }

    participants.forEach((p) => {
      const camStream = remoteStreams[p.socketId];
      if (camStream) {
        feeds.push({
          id: p.socketId,
          type: "remote",
          socketId: p.socketId,
          stream: camStream,
          name: p.name,
          micOn: p.micOn,
          cameraOn: p.cameraOn,
          raisedHand: p.raisedHand,
        });
      }

      const screenStream = remoteScreenStreams[p.socketId];
      if (screenStream) {
        feeds.push({
          id: `${p.socketId}-screen`,
          type: "remote-screen",
          socketId: p.socketId,
          stream: screenStream,
          name: `${p.name} - Trình chiếu`,
          micOn: false,
          cameraOn: true,
        });
      }
    });

    return feeds;
  }, [
    activeLocalStream,
    isSharingScreen,
    showWhiteboard,
    micOn,
    cameraOn,
    raisedHand,
    participants,
    remoteStreams,
    remoteScreenStreams,
    user.fullName,
  ]);

  const renderFeedVideo = (feed: VideoFeed, height: string | number = "100%", avatarSize: number = 80) => {
    if (feed.type === "whiteboard") {
      return (
        <div style={{
          width: "100%",
          height: height,
          background: "#121824",
          padding: 8,
          borderRadius: 12,
          textAlign: "center",
          border: "1px solid rgba(255,255,255,0.08)",
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          alignItems: "center",
          overflow: "hidden"
        }}>
          <div style={{ marginBottom: 6, display: "flex", justifyContent: "center", alignItems: "center", flexWrap: "wrap", gap: 6 }}>
            <Space wrap size="small">
              {["#ffffff", "#ff4d4f", "#1890ff", "#52c41a"].map((color) => (
                <Button
                  key={color}
                  shape="circle"
                  style={{
                    background: color === "#ffffff" ? "#ffffff" : color,
                    border: brushColor === color ? "2px solid #52c41a" : "none",
                    width: 18,
                    height: 18,
                    padding: 0,
                    cursor: "pointer",
                  }}
                  onClick={() => setBrushColor(color)}
                />
              ))}
              <Select
                value={brushSize}
                onChange={setBrushSize}
                style={{ width: 68 }}
                size="small"
                options={[
                  { value: 2, label: "2px" },
                  { value: 4, label: "4px" },
                  { value: 6, label: "6px" },
                  { value: 10, label: "10px" },
                ]}
              />
            </Space>
            <Button danger size="small" onClick={emitClearCanvas} style={{ fontSize: 11, padding: "0 6px" }}>Xóa</Button>
          </div>
          <div style={{ background: "#ffffff", border: "1px solid #d9d9d9", borderRadius: 8, display: "inline-block", cursor: "crosshair", maxWidth: "100%", maxHeight: "calc(100% - 30px)" }}>
            <canvas
              ref={(node) => {
                canvasRef.current = node;
                if (node && whiteboardCanvasRef.current) {
                  const ctx = node.getContext("2d");
                  if (ctx) {
                    ctx.clearRect(0, 0, node.width, node.height);
                    ctx.drawImage(whiteboardCanvasRef.current, 0, 0);
                  }
                }
              }}
              width={800}
              height={500}
              onMouseDown={handleCanvasMouseDown}
              onMouseMove={handleCanvasMouseMove}
              onMouseUp={handleCanvasMouseUpOrLeave}
              onMouseLeave={handleCanvasMouseUpOrLeave}
              style={{ display: "block", maxWidth: "100%", maxHeight: "100%", height: "auto", objectFit: "contain" }}
            />
          </div>
        </div>
      );
    }

    const hasVideo = feed.stream && feed.stream.getVideoTracks().length > 0 && feed.cameraOn;
    if (hasVideo) {
      return (
        <video
          ref={(node) => {
            if (node && node.srcObject !== feed.stream) {
              node.srcObject = feed.stream ?? null;
            }
          }}
          autoPlay
          muted={feed.type === "local" || feed.type === "local-screen" || feed.type === "remote-screen"}
          playsInline
          style={{
            width: "100%",
            height: "100%",
            objectFit: feed.type.includes("screen") ? "contain" : (layoutMode === "grid" ? "cover" : "contain"),
            display: "block"
          }}
        />
      );
    }

    return (
      <div style={{
        width: "100%",
        height: height,
        display: "flex",
        justifyContent: "center",
        alignItems: "center",
        background: "radial-gradient(circle at center, #1e293b, #0f172a)",
        borderRadius: 12,
        border: "1px solid rgba(255,255,255,0.08)"
      }}>
        <Avatar size={avatarSize} style={{ backgroundColor: '#6366f1', fontSize: avatarSize / 2.5, fontWeight: "bold" }}>
          {feed.name.charAt(0).toUpperCase()}
        </Avatar>
      </div>
    );
  };

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

    if (isSharingScreen && screenStreamRef.current) {
      const screenTrack = screenStreamRef.current.getVideoTracks()[0];
      if (screenTrack) {
        peer.addTrack(screenTrack, screenStreamRef.current);
      }
    }

    peer.ontrack = (event) => {
      const remoteStream = event.streams[0];
      if (remoteStream) {
        if (!allRemoteStreamsRef.current.has(remoteSocketId)) {
          allRemoteStreamsRef.current.set(remoteSocketId, new Set());
        }
        allRemoteStreamsRef.current.get(remoteSocketId)!.add(remoteStream);
        updateRemoteStreamsFromCache();
      }
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

  useEffect(() => {
    let isMounted = true;
    let socket: Socket | null = null;

    http
      .get(`/meetings/${meetingId}/details`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      })
      .then((response) => {
        if (!isMounted) return;
        // No privacy mode settings needed locally
        if (Array.isArray(response.data?.messages)) {
          const loadedMessages = response.data.messages.map((m: any) => ({
            id: m._id || crypto.randomUUID(),
            sender: m.senderName || "Unknown",
            message: m.message || undefined,
            fileData: m.fileData || undefined,
            fileName: m.fileName || undefined,
            fileType: m.fileType || undefined,
            sticker: m.sticker || undefined,
            createdAt: m.createdAt || new Date().toISOString(),
          }));
          setMessages(loadedMessages);
        }
      })
      .catch(() => undefined);

    http
      .get(`/meetings/${meetingId}`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      })
      .then((response) => {
        if (!isMounted) return;
        setMeetingData(response.data);
      })
      .catch(() => undefined);

    const startSignaling = () => {
      if (!isMounted) return;

      socket = io(import.meta.env.VITE_API_BASE_URL?.replace("/api", "") ?? "http://localhost:4000", {
        auth: { token },
        transports: ["websocket"],
      });

      socketRef.current = socket;

      socket.on("connect", () => {
        socket?.emit("meeting:request-join", {
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
        setParticipants((existingParticipants ?? []).filter((participant: ParticipantState) => participant.socketId !== socket?.id));

        for (const participant of existingParticipants ?? []) {
          createPeerConnection(participant.socketId, true);
          void ensureLocalTracksOnPeer(participant.socketId).then(() => renegotiatePeer(participant.socketId));
        }
      });

      socket.on("meeting:join-denied", ({ reason }) => {
        message.error(reason ?? "Không thể tham gia room");
        if (onLeave) {
          onLeave();
        } else {
          navigate("/dashboard");
        }
      });

      socket.on("meeting:participants-updated", (items: ParticipantState[]) => {
        setParticipants(items.filter((participant) => participant.socketId !== socket?.id));
      });

      socket.on("meeting:waiting-updated", (items: ParticipantState[]) => {
        setWaitingParticipants(items);
      });

      socket.on("meeting:participant-joined", (participant: ParticipantState) => {
        if (participant.socketId === socket?.id) {
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

      socket.on("meeting:hand-lowered", () => {
        setRaisedHand(false);
        message.info("Host đã hạ tay của bạn");
      });

      socket.on("meeting:removed", ({ reason }) => {
        message.warning(reason ?? "Bạn đã bị remove khỏi meeting");
        if (onLeave) {
          onLeave();
        } else {
          navigate("/dashboard");
        }
      });

      socket.on("meeting:ended", () => {
        message.info("Meeting đã được kết thúc bởi host");
        if (onLeave) {
          onLeave();
        } else {
          navigate("/dashboard");
        }
      });

      socket.on("meeting:chat", (payload) => {
        setMessages((prev) => [
          ...prev,
          {
            id: crypto.randomUUID(),
            sender: payload.sender,
            message: payload.message,
            fileData: payload.fileData,
            fileName: payload.fileName,
            fileType: payload.fileType,
            sticker: payload.sticker,
            createdAt: payload.createdAt,
          },
        ]);
      });

      socket.on("meeting:draw", (payload: any) => {
        if (payload.isClear) {
          clearCanvasLocally();
        } else {
          drawOnCanvas(payload.prevX, payload.prevY, payload.x, payload.y, payload.color, payload.size);
        }
      });

      socket.on("meeting:draw-history", (history: any[]) => {
        history.forEach((payload) => {
          drawOnCanvas(payload.prevX, payload.prevY, payload.x, payload.y, payload.color, payload.size);
        });
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

        socket?.emit("meeting:webrtc-answer", {
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
    };

    navigator.mediaDevices
      .getUserMedia({ video: true, audio: true })
      .then((stream) => {
        if (!isMounted) {
          stream.getTracks().forEach((track) => track.stop());
          return;
        }
        localStreamRef.current = stream;
        setActiveLocalStream(stream);
      })
      .catch(() => {
        if (isMounted) {
          message.warning("Không truy cập được camera/microphone, meeting vẫn có thể dùng chat.");
        }
      })
      .finally(() => {
        if (isMounted) {
          startSignaling();
        }
      });

    return () => {
      isMounted = false;
      if (socket) {
        socket.disconnect();
      }
      socketRef.current = null;
      localStreamRef.current?.getTracks().forEach((track) => track.stop());
      screenStreamRef.current?.getTracks().forEach((track) => track.stop());
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

  const handleFullscreen = (e: React.MouseEvent<HTMLElement>) => {
    e.stopPropagation();
    const btn = e.currentTarget as HTMLElement;
    const card = btn.closest(".video-card");
    const video = card?.querySelector("video");
    if (video) {
      if (video.requestFullscreen) {
        void video.requestFullscreen();
      } else if ((video as any).webkitRequestFullscreen) {
        void (video as any).webkitRequestFullscreen();
      } else if ((video as any).msRequestFullscreen) {
        void (video as any).msRequestFullscreen();
      }
    }
  };

  const sendMessage = (customText?: string, fileData?: string, fileName?: string, fileType?: string, sticker?: string) => {
    const activeText = customText !== undefined ? customText : text;
    if (!activeText.trim() && !fileData && !sticker) {
      return;
    }

    socketRef.current?.emit("meeting:chat", {
      meetingId,
      sender: user.fullName,
      userId: user.id,
      message: activeText.trim() || undefined,
      fileData,
      fileName,
      fileType,
      sticker,
    });

    if (customText === undefined) {
      setText("");
    }
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

  const toggleHandRaise = (nextState: boolean) => {
    setRaisedHand(nextState);
    socketRef.current?.emit("meeting:participant-state", {
      meetingId,
      micOn,
      cameraOn,
      raisedHand: nextState,
    });
  };

  const raisedHandQueue = useMemo(() => {
    const queue: { name: string; socketId?: string; userId: string; raisedHandTime: string }[] = [];

    if (raisedHand) {
      queue.push({
        name: `${user.fullName} (Bạn)`,
        userId: user.id,
        raisedHandTime: new Date().toISOString(),
      });
    }

    participants.forEach((p) => {
      if (p.raisedHand && p.raisedHandTime) {
        queue.push({
          name: p.name,
          socketId: p.socketId,
          userId: p.userId,
          raisedHandTime: p.raisedHandTime,
        });
      }
    });

    return queue.sort((a, b) => new Date(a.raisedHandTime).getTime() - new Date(b.raisedHandTime).getTime());
  }, [raisedHand, participants, user.fullName, user.id]);

  const drawOnCanvas = (prevX: number, prevY: number, x: number, y: number, color: string, size: number) => {
    const offscreen = whiteboardCanvasRef.current;
    if (offscreen) {
      const ctx = offscreen.getContext("2d");
      if (ctx) {
        ctx.beginPath();
        ctx.strokeStyle = color;
        ctx.lineWidth = size;
        ctx.lineCap = "round";
        ctx.lineJoin = "round";
        ctx.moveTo(prevX, prevY);
        ctx.lineTo(x, y);
        ctx.stroke();
        ctx.closePath();
      }
    }

    const canvas = canvasRef.current;
    if (canvas) {
      const ctx = canvas.getContext("2d");
      if (ctx) {
        ctx.beginPath();
        ctx.strokeStyle = color;
        ctx.lineWidth = size;
        ctx.lineCap = "round";
        ctx.lineJoin = "round";
        ctx.moveTo(prevX, prevY);
        ctx.lineTo(x, y);
        ctx.stroke();
        ctx.closePath();
      }
    }
  };

  const clearCanvasLocally = () => {
    const offscreen = whiteboardCanvasRef.current;
    if (offscreen) {
      const ctx = offscreen.getContext("2d");
      ctx?.clearRect(0, 0, offscreen.width, offscreen.height);
    }
    const canvas = canvasRef.current;
    if (canvas) {
      const ctx = canvas.getContext("2d");
      ctx?.clearRect(0, 0, canvas.width, canvas.height);
    }
  };

  const handleCanvasMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * canvas.width;
    const y = ((e.clientY - rect.top) / rect.height) * canvas.height;
    isDrawingRef.current = true;
    prevCoordsRef.current = { x, y };
  };

  const handleCanvasMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!isDrawingRef.current) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * canvas.width;
    const y = ((e.clientY - rect.top) / rect.height) * canvas.height;
    const prev = prevCoordsRef.current;

    drawOnCanvas(prev.x, prev.y, x, y, brushColor, brushSize);

    socketRef.current?.emit("meeting:draw", {
      meetingId,
      prevX: prev.x,
      prevY: prev.y,
      x,
      y,
      color: brushColor,
      size: brushSize,
    });

    prevCoordsRef.current = { x, y };
  };

  const handleCanvasMouseUpOrLeave = () => {
    isDrawingRef.current = false;
  };

  const emitClearCanvas = () => {
    clearCanvasLocally();
    socketRef.current?.emit("meeting:draw", {
      meetingId,
      isClear: true,
    });
  };

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getDisplayMedia({
        video: true,
        audio: true,
      });

      recordingStreamRef.current = stream;
      recordedChunksRef.current = [];

      const options = { mimeType: "video/webm; codecs=vp9" };
      let recorder: MediaRecorder;
      try {
        recorder = new MediaRecorder(stream, options);
      } catch {
        recorder = new MediaRecorder(stream);
      }

      recorder.ondataavailable = (e) => {
        if (e.data && e.data.size > 0) {
          recordedChunksRef.current.push(e.data);
        }
      };

      recorder.onstop = () => {
        const blob = new Blob(recordedChunksRef.current, {
          type: "video/webm",
        });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        document.body.appendChild(a);
        a.style.display = "none";
        a.href = url;
        a.download = `gg-meet-record-${meetingId}-${new Date().toISOString()}.webm`;
        a.click();
        window.URL.revokeObjectURL(url);
        document.body.removeChild(a);

        stream.getTracks().forEach((track) => track.stop());
        setIsRecording(false);
        message.success("Đã lưu video ghi hình cuộc họp về thiết bị");
      };

      mediaRecorderRef.current = recorder;
      recorder.start(1000);
      setIsRecording(true);
      message.success("Bắt đầu ghi hình cuộc họp. Vui lòng chia sẻ màn hình/tab cuộc họp kèm âm thanh.");

      stream.getVideoTracks()[0].onended = () => {
        if (recorder.state !== "inactive") {
          recorder.stop();
        }
      };
    } catch {
      message.warning("Không thể kích hoạt ghi hình cuộc họp");
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== "inactive") {
      mediaRecorderRef.current.stop();
    }
  };

  const stopScreenShareFlow = () => {
    setIsSharingScreen(false);

    const screenTrack = screenStreamRef.current?.getVideoTracks()[0];
    if (screenTrack) {
      for (const [remoteSocketId, peer] of peersRef.current.entries()) {
        const sender = peer.getSenders().find((s) => s.track === screenTrack);
        if (sender) {
          peer.removeTrack(sender);
        }
        void renegotiatePeer(remoteSocketId);
      }
    }

    if (screenStreamRef.current) {
      screenStreamRef.current.getTracks().forEach((track) => track.stop());
      screenStreamRef.current = null;
    }

    socketRef.current?.emit("meeting:participant-state", {
      meetingId,
      micOn,
      cameraOn,
      raisedHand,
      sharingScreen: false,
      screenStreamId: null,
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

      screenStreamRef.current = display;
      setIsSharingScreen(true);

      for (const [remoteSocketId, peer] of peersRef.current.entries()) {
        peer.addTrack(screenTrack, display);
        await renegotiatePeer(remoteSocketId);
      }

      socketRef.current?.emit("meeting:participant-state", {
        meetingId,
        micOn,
        cameraOn,
        raisedHand,
        sharingScreen: true,
        screenStreamId: display.id,
      });

      screenTrack.onended = () => {
        stopScreenShareFlow();
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
    if (onLeave) {
      onLeave();
    } else {
      navigate("/dashboard");
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

  const tabItems = useMemo(() => {
    const items: any[] = [
      {
        key: "participants",
        label: `Participants (${participants.length + 1})`,
        children: (
          <div>
            {raisedHandQueue.length > 0 && (
              <div style={{ marginBottom: 16, border: "1px solid #ffe58f", background: "#fffbe6", padding: 8, borderRadius: 8 }}>
                <Typography.Title level={5} style={{ color: "#d48806", margin: "0 0 8px 0", display: "flex", alignItems: "center", gap: 8, fontSize: "14px" }}>
                  <span>✋</span> Hàng đợi phát biểu ({raisedHandQueue.length})
                </Typography.Title>
                <List
                  size="small"
                  dataSource={raisedHandQueue}
                  renderItem={(item, index) => (
                    <List.Item
                      style={{ padding: "4px 0" }}
                      actions={
                        isHostLike && item.socketId
                          ? [
                              <Button
                                key="lower-hand"
                                size="small"
                                type="text"
                                danger
                                onClick={() =>
                                  socketRef.current?.emit("meeting:host-lower-hand", {
                                    meetingId,
                                    targetSocketId: item.socketId,
                                    actorUserId: user.id,
                                  })
                                }
                              >
                                Hạ tay
                              </Button>,
                            ]
                          : []
                      }
                    >
                      <Typography.Text strong>
                        {index + 1}. {item.name}
                      </Typography.Text>
                    </List.Item>
                  )}
                />
              </div>
            )}

            <div style={{ marginBottom: 16 }}>
              <List
                size="small"
                dataSource={participants}
                locale={{ emptyText: "Chưa có participant" }}
                renderItem={(participant) => (
                  <List.Item>
                    <div style={{ display: "flex", flexDirection: "column", width: "100%" }}>
                      <Typography.Text strong>
                        {participant.name} {participant.raisedHand && <span style={{ color: "#d48806", marginLeft: 4 }}>✋</span>}
                      </Typography.Text>
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
          </div>
        ),
      },
    ];

    if (isHostLike) {
      items.push({
        key: "waiting",
        label: `Waiting Room (${waitingParticipants.length})`,
        children: (
          <div style={{ marginBottom: 16 }}>
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
        ),
      });
    }

    items.push({
      key: "chat",
      label: `Chat`,
      children: (
        <div>
          <List
            size="small"
            dataSource={sortedMessages}
            locale={{ emptyText: "Chưa có tin nhắn" }}
            renderItem={(item) => (
              <List.Item style={{ padding: "8px 0" }}>
                <div style={{ width: "100%" }}>
                  <Typography.Text strong>{item.sender}: </Typography.Text>
                  {item.message && <Typography.Text style={{ display: "block", marginTop: 2 }}>{item.message}</Typography.Text>}
                  
                  {item.fileData && (
                    <div style={{ marginTop: 6 }}>
                      {item.fileType?.startsWith("image/") ? (
                        <img
                          src={item.fileData}
                          alt={item.fileName ?? "attachment"}
                          style={{ maxWidth: "100%", maxHeight: 150, borderRadius: 8, border: "1px solid rgba(255,255,255,0.1)" }}
                        />
                      ) : (
                        <a href={item.fileData} download={item.fileName || "file"} style={{ color: "#1677ff", textDecoration: "underline", fontSize: 12 }}>
                          📁 Download: {item.fileName || "attachment"}
                        </a>
                      )}
                    </div>
                  )}

                  {item.sticker && (
                    <div style={{ fontSize: 40, marginTop: 4 }}>
                      {item.sticker}
                    </div>
                  )}
                </div>
              </List.Item>
            )}
            style={{ minHeight: 180, maxHeight: 400, overflowY: "auto" }}
          />
          <div style={{ marginTop: 12, display: "flex", flexDirection: "column", gap: 8 }}>
            <div style={{ display: "flex", gap: 8 }}>
              <Popover
                open={stickerPopoverOpen}
                onOpenChange={setStickerPopoverOpen}
                content={
                  <Space wrap style={{ width: 220 }}>
                    {["🐱", "🐶", "🚀", "🎉", "👍", "❤️", "😂", "😮", "🔥", "💯", "👏", "💩"].map((st) => (
                      <Button
                        key={st}
                        type="text"
                        onClick={() => {
                          setStickerPopoverOpen(false);
                          sendMessage("", undefined, undefined, undefined, st);
                        }}
                        style={{ fontSize: 24, padding: 4, width: 40, height: 40 }}
                      >
                        {st}
                      </Button>
                    ))}
                  </Space>
                }
                title="Chọn Nhãn Dán"
                trigger="click"
              >
                <Button size="small" icon={<span>😊</span>} style={{ borderRadius: 6 }}>Nhãn dán</Button>
              </Popover>

              <input
                type="file"
                id="meeting-file-picker"
                style={{ display: "none" }}
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (!file) return;
                  const reader = new FileReader();
                  reader.onload = (evt) => {
                    const base64 = evt.target?.result as string;
                    sendMessage("", base64, file.name, file.type);
                  };
                  reader.readAsDataURL(file);
                  e.target.value = "";
                }}
              />
              <Button
                size="small"
                icon={<span>📎</span>}
                onClick={() => document.getElementById("meeting-file-picker")?.click()}
                style={{ borderRadius: 6 }}
              >
                Gửi File
              </Button>
            </div>
            
            <Input.Search
              value={text}
              onChange={(event) => setText(event.target.value)}
              onSearch={() => sendMessage()}
              enterButton="Gửi"
              placeholder="Nhập tin nhắn..."
              style={{ borderRadius: 6 }}
            />
          </div>
        </div>
      ),
    });

    return items;
  }, [
    participants,
    raisedHandQueue,
    isHostLike,
    waitingParticipants,
    sortedMessages,
    text,
    user.fullName,
    user.id,
    meetingId,
  ]);

  if (waitingRoom) {
    const getCategoryLabel = (cat: string) => {
      const map: Record<string, string> = {
        personal: "Cá nhân",
        interview: "Phỏng vấn",
        team_meeting: "Họp nhóm",
        client_meeting: "Khách hàng",
        training: "Đào tạo",
      };
      return map[cat] || "Cuộc họp trực tuyến";
    };
    const categoryLabel = meetingData ? getCategoryLabel(meetingData.category) : "Cuộc họp trực tuyến";

    return (
      <>
        <style dangerouslySetInnerHTML={{ __html: `
          @keyframes radar-pulse {
            0% { transform: scale(0.6); opacity: 0.6; }
            100% { transform: scale(1.8); opacity: 0; }
          }
          .waiting-room-bg {
            display: flex;
            align-items: center;
            justify-content: center;
            min-height: 100vh;
            width: 100%;
            background: radial-gradient(circle at center, #111422 0%, #07090e 100%);
            padding: 24px;
            overflow: hidden;
            position: relative;
          }
          .waiting-room-card {
            max-width: 480px;
            width: 100%;
            background: rgba(26, 29, 39, 0.45);
            backdrop-filter: blur(20px);
            -webkit-backdrop-filter: blur(20px);
            border: 1px solid rgba(255, 255, 255, 0.08);
            border-radius: 24px;
            padding: 48px 32px 32px 32px;
            text-align: center;
            box-shadow: 0 24px 64px rgba(0, 0, 0, 0.6);
            display: flex;
            flex-direction: column;
            align-items: center;
            animation: fadeIn 0.4s ease-out;
          }
          .waiting-room-radar {
            position: relative;
            width: 120px;
            height: 120px;
            margin-bottom: 24px;
            display: flex;
            align-items: center;
            justify-content: center;
          }
          .radar-circle {
            position: absolute;
            width: 100%;
            height: 100%;
            border-radius: 50%;
            background: var(--accent);
            opacity: 0.15;
            animation: radar-pulse 2.2s infinite ease-out;
          }
          .radar-circle:nth-child(2) {
            animation-delay: 0.7s;
          }
          .radar-circle:nth-child(3) {
            animation-delay: 1.4s;
          }
          .radar-icon-wrapper {
            position: relative;
            width: 76px;
            height: 76px;
            border-radius: 50%;
            background: linear-gradient(135deg, var(--accent) 0%, #4f46e5 100%);
            display: flex;
            align-items: center;
            justify-content: center;
            color: white;
            font-size: 32px;
            box-shadow: 0 8px 32px rgba(99, 102, 241, 0.35);
            z-index: 2;
          }
          .waiting-room-title {
            font-size: 22px;
            font-weight: 700;
            margin-bottom: 8px;
            color: #ffffff;
            letter-spacing: -0.5px;
          }
          .waiting-room-subtitle {
            color: var(--text-secondary);
            font-size: 14px;
            line-height: 1.5;
            margin-bottom: 28px;
            max-width: 360px;
          }
          .meeting-info-box {
            background: rgba(255, 255, 255, 0.02);
            border: 1px solid rgba(255, 255, 255, 0.05);
            border-radius: 16px;
            padding: 20px;
            width: 100%;
            margin-bottom: 32px;
            text-align: left;
          }
          .meeting-info-row {
            display: flex;
            margin-bottom: 10px;
          }
          .meeting-info-row:last-child {
            margin-bottom: 0;
          }
          .meeting-info-label {
            color: var(--text-secondary);
            width: 110px;
            font-size: 13px;
          }
          .meeting-info-value {
            color: var(--text-primary);
            font-weight: 600;
            font-size: 14px;
            flex: 1;
            overflow: hidden;
            text-overflow: ellipsis;
            white-space: nowrap;
          }
          .leave-button {
            background: rgba(255, 255, 255, 0.03) !important;
            border: 1px solid rgba(255, 255, 255, 0.1) !important;
            color: var(--text-secondary) !important;
            height: 42px !important;
            border-radius: 12px !important;
            padding: 0 28px !important;
            font-weight: 500 !important;
            font-size: 14px !important;
            transition: all 0.25s ease !important;
          }
          .leave-button:hover {
            background: rgba(239, 68, 68, 0.08) !important;
            border-color: rgba(239, 68, 68, 0.3) !important;
            color: #ef4444 !important;
          }
          @keyframes fadeIn {
            from { opacity: 0; transform: translateY(16px); }
            to { opacity: 1; transform: translateY(0); }
          }
        ` }} />
        <div className="waiting-room-bg">
          <div className="waiting-room-card">
            <div className="waiting-room-radar">
              <div className="radar-circle" />
              <div className="radar-circle" />
              <div className="radar-circle" />
              <div className="radar-icon-wrapper">
                <VideoCameraOutlined />
              </div>
            </div>
            
            <h2 className="waiting-room-title">Phòng Chờ Cuộc Họp</h2>
            <p className="waiting-room-subtitle">
              Vui lòng đợi một lát. Người tổ chức cuộc họp đang duyệt yêu cầu tham gia của bạn.
            </p>
            
            <div className="meeting-info-box">
              <div className="meeting-info-row">
                <span className="meeting-info-label">Cuộc họp:</span>
                <span className="meeting-info-value" title={meetingData?.title || meetingId}>
                  {meetingData?.title || meetingId}
                </span>
              </div>
              <div className="meeting-info-row">
                <span className="meeting-info-label">Chủ đề:</span>
                <span className="meeting-info-value">{categoryLabel}</span>
              </div>
              <div className="meeting-info-row">
                <span className="meeting-info-label">Trạng thái:</span>
                <span className="meeting-info-value" style={{ color: "var(--accent)" }}>
                  Đang chờ duyệt...
                </span>
              </div>
            </div>
            
            <Button
              className="leave-button"
              onClick={() => {
                if (onLeave) {
                  onLeave();
                } else {
                  navigate("/dashboard");
                }
              }}
            >
              Rời phòng chờ
            </Button>
          </div>
        </div>
      </>
    );
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

  if (isMinimized) {
    const firstFeed = videoFeeds.find((f) => f.type.startsWith("remote")) || videoFeeds[0];

    return (
      <div style={{
        position: "relative",
        width: "100%",
        height: "100%",
        background: "#0b0f17",
        display: "flex",
        flexDirection: "column",
        justifyContent: "space-between",
        padding: 8
      }}>
        <div style={{ position: "relative", flex: 1, borderRadius: 10, overflow: "hidden", background: "#121824", border: "1px solid rgba(255,255,255,0.06)" }}>
          {firstFeed ? (
            renderFeedVideo(firstFeed, "100%", 48)
          ) : (
            <div style={{ width: "100%", height: "100%", background: "#121824" }} />
          )}
          <div style={{ position: "absolute", bottom: 8, left: 8, padding: "2px 8px", background: "rgba(0,0,0,0.5)", borderRadius: 6, color: "#fff", fontSize: 11 }}>
            {firstFeed?.name ?? "Participant"}
          </div>
        </div>

        <div style={{
          display: "flex",
          justifyContent: "center",
          alignItems: "center",
          gap: 12,
          marginTop: 8,
          background: "rgba(255,255,255,0.04)",
          padding: "6px 12px",
          borderRadius: 8
        }}>
          <Button
            type="text"
            shape="circle"
            icon={micOn ? <span>🎙️</span> : <span style={{ color: "#ff4d4f" }}>🔇</span>}
            onClick={() => toggleMic(!micOn)}
            style={{ color: "#fff", background: micOn ? "rgba(255,255,255,0.12)" : "rgba(255,77,79,0.2)" }}
          />
          <Button
            type="text"
            shape="circle"
            icon={cameraOn ? <span>📷</span> : <span style={{ color: "#ff4d4f" }}>❌</span>}
            onClick={() => toggleCamera(!cameraOn)}
            style={{ color: "#fff", background: cameraOn ? "rgba(255,255,255,0.12)" : "rgba(255,77,79,0.2)" }}
          />
          <Button
            type="primary"
            shape="circle"
            icon={<span>🗖</span>}
            onClick={onMaximize}
            style={{ background: "#1677ff" }}
          />
          <Button
            danger
            type="primary"
            shape="circle"
            icon={<span>🛑</span>}
            onClick={onLeave || leaveMeeting}
          />
        </div>
      </div>
    );
  }

  return (
    <Row gutter={[16, 16]}>
      <Col xs={24} lg={sideCollapsed ? 24 : 16}>
        <Card
          title={<span style={{ color: "#ffffff" }}>Meeting Room: {meetingId}</span>}
          extra={
            <Space>
              <Select
                value={layoutMode}
                onChange={(val) => {
                  setLayoutMode(val);
                  if (val === "grid") setFocusSocketId(null);
                }}
                getPopupContainer={(triggerNode) => triggerNode.parentNode}
                style={{ width: 140 }}
                options={[
                  { value: "grid", label: "Bố cục ô lưới" },
                  { value: "focus", label: "Tiêu điểm (Focus)" }
                ]}
              />
              {isHost && (
                <Button danger icon={<StopOutlined />} onClick={endMeeting}>
                  Cancel Meeting
                </Button>
              )}
              {!isHost && <Button onClick={onLeave || leaveMeeting}>Leave Meeting</Button>}
            </Space>
          }
          style={{ background: "#0b0f17", borderColor: "rgba(255,255,255,0.08)" }}
          bodyStyle={{ padding: 12 }}
        >
          {!joined && <Alert type="warning" showIcon message="Đang kết nối room..." style={{ marginBottom: 12 }} />}
          {isRecording && (
            <Alert
              type="error"
              message={<span style={{ fontWeight: "bold" }}>🔴 Đang ghi hình cuộc họp...</span>}
              style={{ marginBottom: 12 }}
            />
          )}

          <div className="meeting-stage">
            {layoutMode === "grid" ? (
              <div className="video-grid">
                {videoFeeds.map((feed) => {
                  return (
                    <div className="video-card" key={feed.id}>
                      {renderFeedVideo(feed, "200px", 64)}
                      <div className="video-overlay-name">
                        <span>{feed.name}</span>
                        {feed.raisedHand && <span style={{ color: "#ffe58f" }}>✋</span>}
                      </div>
                      <div style={{ position: "absolute", top: 12, right: 12, zIndex: 10 }}>
                        <Button
                          type="text"
                          shape="circle"
                          icon={<span>⛶</span>}
                          onClick={handleFullscreen}
                          style={{ color: "#fff", background: "rgba(0,0,0,0.5)", border: "none" }}
                        />
                      </div>
                      {!feed.type.includes("screen") && (
                        <div className="video-overlay-status">
                          <div className="video-status-badge" style={{ borderColor: feed.micOn ? "rgba(255,255,255,0.2)" : "#ff4d4f" }}>
                            {feed.micOn ? <span>🎙️</span> : <span style={{ color: "#ff4d4f" }}>🔇</span>}
                          </div>
                          <div className="video-status-badge" style={{ borderColor: feed.cameraOn ? "rgba(255,255,255,0.2)" : "#ff4d4f" }}>
                            {feed.cameraOn ? <span>📷</span> : <span style={{ color: "#ff4d4f" }}>❌</span>}
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            ) : (
              <div style={{ width: "100%" }}>
                {(() => {
                  const activeFocusId = focusSocketId || (videoFeeds[0] ? videoFeeds[0].id : "local");
                  const focusFeed = videoFeeds.find((f) => f.id === activeFocusId) || videoFeeds[0];

                  if (!focusFeed) return null;

                  return (
                    <div className="video-card" style={{ width: "100%", height: 420, position: "relative", borderRadius: 12, overflow: "hidden", background: "#121824", border: "1px solid rgba(255,255,255,0.08)", marginBottom: 12 }}>
                      {renderFeedVideo(focusFeed, "420px", 96)}
                      <div className="video-overlay-name">
                        <span>{focusFeed.name}</span>
                      </div>
                      <div style={{ position: "absolute", top: 12, right: 12, zIndex: 10 }}>
                        <Button
                          type="text"
                          shape="circle"
                          icon={<span>⛶</span>}
                          onClick={handleFullscreen}
                          style={{ color: "#fff", background: "rgba(0,0,0,0.5)", border: "none" }}
                        />
                      </div>
                    </div>
                  );
                })()}

                <div style={{ display: "flex", gap: 12, overflowX: "auto", padding: "8px 4px", background: "rgba(255,255,255,0.02)", borderRadius: 10, border: "1px solid rgba(255,255,255,0.04)" }}>
                  {videoFeeds.map((feed) => {
                    const activeFocusId = focusSocketId || (videoFeeds[0] ? videoFeeds[0].id : "local");
                    if (feed.id === activeFocusId) return null;
                    return (
                      <div
                        className="video-card"
                        key={feed.id}
                        style={{ width: 140, height: 100, flexShrink: 0, position: "relative", borderRadius: 8, overflow: "hidden", cursor: "pointer", border: "1px solid rgba(255,255,255,0.12)" }}
                        onClick={() => setFocusSocketId(feed.id)}
                      >
                        {renderFeedVideo(feed, "100px", 40)}
                        <div style={{ position: "absolute", bottom: 4, left: 4, background: "rgba(0,0,0,0.5)", borderRadius: 4, padding: "1px 4px", fontSize: 10, color: "#fff" }}>
                          {feed.name}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            <div className="floating-controls">
              {onMinimize && (
                <Button
                  icon={<span>🗕</span>}
                  onClick={onMinimize}
                  style={{ borderRadius: 6 }}
                >
                  Thu nhỏ
                </Button>
              )}
              <Switch checked={micOn} checkedChildren={<AudioOutlined />} unCheckedChildren={<AudioMutedOutlined />} onChange={toggleMic} />
              <Switch checked={cameraOn} checkedChildren={<VideoCameraOutlined />} unCheckedChildren={<VideoCameraAddOutlined />} onChange={toggleCamera} />
              <Button
                type={isSharingScreen ? "primary" : "default"}
                danger={isSharingScreen}
                icon={isSharingScreen ? <VideoCameraOutlined /> : <VideoCameraAddOutlined />}
                onClick={isSharingScreen ? stopScreenShareFlow : () => void shareScreen()}
              >
                {isSharingScreen ? "Dừng chia sẻ" : "Chia sẻ màn hình"}
              </Button>
              <Button
                type={raisedHand ? "primary" : "default"}
                icon={<span>✋</span>}
                onClick={() => toggleHandRaise(!raisedHand)}
              >
                {raisedHand ? "Hạ tay" : "Giơ tay"}
              </Button>
              <Button
                type={showWhiteboard ? "primary" : "default"}
                danger={showWhiteboard}
                icon={<span>📋</span>}
                onClick={() => setShowWhiteboard(!showWhiteboard)}
              >
                {showWhiteboard ? "Tắt bảng vẽ" : "Bảng vẽ chung"}
              </Button>
              <Button
                danger={isRecording}
                type={isRecording ? "primary" : "default"}
                icon={<span style={{ display: "inline-block", width: 10, height: 10, borderRadius: "50%", background: isRecording ? "#fff" : "#ff4d4f", marginRight: 4 }} />}
                onClick={isRecording ? stopRecording : () => void startRecording()}
              >
                {isRecording ? "Dừng ghi" : "Ghi hình"}
              </Button>
            </div>
          </div>
        </Card>
      </Col>

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
            <Tabs defaultActiveKey="participants" items={tabItems} size="small" />
          </Card>
        </div>
      </Col>
    </Row>
  );
};
