import React, { useEffect, useRef, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  FlatList,
  TextInput,
  Modal,
  SafeAreaView,
  Dimensions,
  Alert,
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import { useRoute, useNavigation, RouteProp } from "@react-navigation/native";
import { StackNavigationProp } from "@react-navigation/stack";
import { io, Socket } from "socket.io-client";
import {
  RTCPeerConnection,
  RTCIceCandidate,
  RTCSessionDescription,
  RTCView,
  MediaStream,
  mediaDevices,
} from "react-native-webrtc";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { RootStackParamList } from "../../App";
import { SOCKET_URL, http } from "../api/http";

type MeetingRoomScreenRouteProp = RouteProp<RootStackParamList, "MeetingRoom">;
type MeetingRoomScreenNavigationProp = StackNavigationProp<RootStackParamList, "MeetingRoom">;

interface ParticipantFeed {
  socketId: string;
  userId: string;
  name: string;
  stream: MediaStream | null;
  micOn: boolean;
  cameraOn: boolean;
}

interface ChatMsg {
  sender: string;
  message: string;
  createdAt: string;
}

const rtcConfig = {
  iceServers: [{ urls: "stun:stun.l.google.com:19302" }],
};

export const MeetingRoomScreen = () => {
  const route = useRoute<MeetingRoomScreenRouteProp>();
  const navigation = useNavigation<MeetingRoomScreenNavigationProp>();
  const { meetingId } = route.params;

  const [loading, setLoading] = useState(true);
  const [isWaiting, setIsWaiting] = useState(false);
  const [meetingData, setMeetingData] = useState<any>(null);

  // States của cuộc gọi
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [remoteFeeds, setRemoteFeeds] = useState<ParticipantFeed[]>([]);
  const [micOn, setMicOn] = useState(true);
  const [cameraOn, setCameraOn] = useState(true);
  const [isFrontCamera, setIsFrontCamera] = useState(true);

  // States của Chat
  const [showChat, setShowChat] = useState(false);
  const [chatText, setChatText] = useState("");
  const [chatMessages, setChatMessages] = useState<ChatMsg[]>([]);

  // Refs quản lý WebRTC và Socket
  const socketRef = useRef<Socket | null>(null);
  const localStreamRef = useRef<MediaStream | null>(null);
  const peersRef = useRef<Map<string, RTCPeerConnection>>(new Map());
  const currentUserRef = useRef<any>(null);

  useEffect(() => {
    // 1. Tải thông tin cuộc họp cơ bản từ API
    const loadMeetingInfo = async () => {
      try {
        const response = await http.get(`/meetings/${meetingId}`);
        setMeetingData(response.data);
      } catch (e) {
        console.warn("Không thể tải thông tin cuộc họp");
      }
    };

    // 2. Lấy thông tin User hiện tại từ dashboard
    const loadUserInfo = async () => {
      try {
        const response = await http.get("/dashboard");
        // Giả sử lấy thông tin user từ danh sách công việc/thông báo hoặc API profile nếu có
        // Trong trường hợp này, ta có thể lấy tên từ localStorage hoặc dùng email làm định danh
        const token = await AsyncStorage.getItem("token");
        if (token) {
          const base64Url = token.split(".")[1];
          const base64 = base64Url.replace(/-/g, "+").replace(/_/g, "/");
          const jsonPayload = decodeURIComponent(
            atob(base64)
              .split("")
              .map((c) => "%" + ("00" + c.charCodeAt(0).toString(16)).slice(-2))
              .join("")
          );
          currentUserRef.current = JSON.parse(jsonPayload);
        }
      } catch (err) {
        console.warn("Lỗi giải mã token:", err);
      }
    };

    loadMeetingInfo();
    loadUserInfo();
    startMeetingFlow();

    return () => {
      cleanup();
    };
  }, [meetingId]);

  // Giải mã token ở môi trường React Native
  const atob = (input: string) => {
    const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/=";
    let output = "";
    let r1 = 0;
    let r2 = 0;
    for (
      let bc = 0, bs = 0, idx = 0;
      (r2 = chars.indexOf(input.charAt(idx++))), idx <= input.length;
      ~r2 && ((r1 = bc % 4 ? r1 * 64 + r2 : r2), bc++ % 4)
        ? (output += String.fromCharCode(255 & (r1 >> ((-2 * bc) & 6))))
        : 0
    ) {
    }
    return output;
  };

  const startMeetingFlow = async () => {
    try {
      // 1. Lấy luồng Media cục bộ (Camera + Micro)
      const stream = await mediaDevices.getUserMedia({
        audio: true,
        video: {
          facingMode: "user",
        },
      });
      localStreamRef.current = stream;
      setLocalStream(stream);

      // 2. Kết nối Socket.IO
      const token = await AsyncStorage.getItem("token");
      const socket = io(SOCKET_URL || "http://localhost:4000", {
        auth: { token },
        transports: ["websocket"],
      });
      socketRef.current = socket;

      socket.on("connect", () => {
        socket.emit("meeting:request-join", {
          meetingId,
          userId: currentUserRef.current?.id || `user_${Date.now()}`,
          name: currentUserRef.current?.fullName || "Khách di động",
        });
      });

      // 3. Đăng ký các sự kiện báo hiệu (Signaling Events)
      socket.on("meeting:waiting-room", () => {
        setIsWaiting(true);
        setLoading(false);
      });

      socket.on("meeting:join-approved", async ({ participants }) => {
        setIsWaiting(false);
        setLoading(false);

        // Tạo Peer Connection đến các thành viên đang có sẵn trong phòng
        if (Array.isArray(participants)) {
          for (const p of participants) {
            await getOrCreatePeerConnection(p.socketId, p.userId, p.name, true);
          }
        }
        syncLocalState();
      });

      socket.on("meeting:join-denied", ({ reason }) => {
        Alert.alert("Từ chối tham gia", reason || "Yêu cầu của bạn đã bị từ chối.");
        cleanup();
        navigation.goBack();
      });

      socket.on("meeting:participant-joined", async (participant) => {
        // Có thành viên mới tham gia phòng họp
        await getOrCreatePeerConnection(
          participant.socketId,
          participant.userId,
          participant.name,
          false
        );
      });

      socket.on("meeting:participant-left", ({ socketId }) => {
        closePeerConnection(socketId);
      });

      socket.on("meeting:webrtc-offer", async ({ offer, fromSocketId }) => {
        const pc = await getOrCreatePeerConnection(fromSocketId, "", "", false);
        await pc.setRemoteDescription(new RTCSessionDescription(offer));

        const answer = await pc.createAnswer();
        await pc.setLocalDescription(answer);

        socketRef.current?.emit("meeting:webrtc-answer", {
          meetingId,
          toSocketId: fromSocketId,
          fromSocketId: socketRef.current.id,
          answer,
        });
      });

      socket.on("meeting:webrtc-answer", async ({ answer, fromSocketId }) => {
        const pc = peersRef.current.get(fromSocketId);
        if (pc) {
          await pc.setRemoteDescription(new RTCSessionDescription(answer));
        }
      });

      socket.on("meeting:webrtc-ice", async ({ candidate, fromSocketId }) => {
        const pc = peersRef.current.get(fromSocketId);
        if (pc) {
          await pc.addIceCandidate(new RTCIceCandidate(candidate));
        }
      });

      socket.on("meeting:participants-updated", (updatedList: any[]) => {
        // Đồng bộ trạng thái mic/camera của các thành viên
        setRemoteFeeds((prevFeeds) =>
          prevFeeds.map((feed) => {
            const match = updatedList.find((u) => u.socketId === feed.socketId);
            if (match) {
              return {
                ...feed,
                micOn: match.micOn,
                cameraOn: match.cameraOn,
              };
            }
            return feed;
          })
        );
      });

      socket.on("meeting:chat", (payload: any) => {
        setChatMessages((prev) => [
          ...prev,
          {
            sender: payload.sender,
            message: payload.message || (payload.sticker ? `Nhãn dán: ${payload.sticker}` : "Đã gửi tệp"),
            createdAt: payload.createdAt || new Date().toISOString(),
          },
        ]);
      });

      socket.on("meeting:ended", () => {
        Alert.alert("Cuộc họp kết thúc", "Người tổ chức đã kết thúc cuộc họp này.");
        cleanup();
        navigation.goBack();
      });

      socket.on("meeting:removed", () => {
        Alert.alert("Thông báo", "Bạn đã bị xóa khỏi cuộc họp.");
        cleanup();
        navigation.goBack();
      });
    } catch (e) {
      console.error("Lỗi khi kết nối phòng họp:", e);
      Alert.alert("Lỗi", "Không thể truy cập camera hoặc microphone.");
      navigation.goBack();
    }
  };

  const getOrCreatePeerConnection = async (
    targetSocketId: string,
    userId: string,
    name: string,
    initiateOffer: boolean
  ): Promise<RTCPeerConnection> => {
    let pc = peersRef.current.get(targetSocketId);
    if (pc) return pc;

    pc = new RTCPeerConnection(rtcConfig);
    peersRef.current.set(targetSocketId, pc);

    // Thêm luồng camera/mic cục bộ vào Peer Connection
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach((track) => {
        pc?.addTrack(track, localStreamRef.current!);
      });
    }

    // Lắng nghe luồng media từ thành viên khác gửi về
    (pc as any).ontrack = (event: any) => {
      if (event.streams && event.streams[0]) {
        const remoteStream = event.streams[0];
        setRemoteFeeds((prev) => {
          const exists = prev.some((f) => f.socketId === targetSocketId);
          if (exists) {
            return prev.map((f) =>
              f.socketId === targetSocketId ? { ...f, stream: remoteStream } : f
            );
          }
          return [
            ...prev,
            {
              socketId: targetSocketId,
              userId,
              name,
              stream: remoteStream,
              micOn: true,
              cameraOn: true,
            },
          ];
        });
      }
    };

    // Lắng nghe ICE Candidate
    (pc as any).onicecandidate = (event: any) => {
      if (event.candidate) {
        socketRef.current?.emit("meeting:webrtc-ice", {
          meetingId,
          toSocketId: targetSocketId,
          fromSocketId: socketRef.current.id,
          candidate: event.candidate,
        });
      }
    };

    if (initiateOffer) {
      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);
      socketRef.current?.emit("meeting:webrtc-offer", {
        meetingId,
        toSocketId: targetSocketId,
        fromSocketId: socketRef.current.id,
        offer,
      });
    }

    return pc;
  };

  const closePeerConnection = (socketId: string) => {
    const pc = peersRef.current.get(socketId);
    if (pc) {
      pc.close();
      peersRef.current.delete(socketId);
    }
    setRemoteFeeds((prev) => prev.filter((feed) => feed.socketId !== socketId));
  };

  const syncLocalState = () => {
    socketRef.current?.emit("meeting:participant-state", {
      meetingId,
      micOn,
      cameraOn,
      sharingScreen: false,
    });
  };

  const toggleMic = () => {
    const nextState = !micOn;
    setMicOn(nextState);
    if (localStreamRef.current) {
      localStreamRef.current.getAudioTracks().forEach((track) => {
        track.enabled = nextState;
      });
    }
    socketRef.current?.emit("meeting:participant-state", {
      meetingId,
      micOn: nextState,
      cameraOn,
    });
  };

  const toggleCamera = () => {
    const nextState = !cameraOn;
    setCameraOn(nextState);
    if (localStreamRef.current) {
      localStreamRef.current.getVideoTracks().forEach((track) => {
        track.enabled = nextState;
      });
    }
    socketRef.current?.emit("meeting:participant-state", {
      meetingId,
      micOn,
      cameraOn: nextState,
    });
  };

  const switchCamera = () => {
    if (localStreamRef.current) {
      const videoTrack = localStreamRef.current.getVideoTracks()[0];
      if (videoTrack) {
        // @ts-ignore: switchCamera is a react-native-webrtc specific extension
        videoTrack._switchCamera();
        setIsFrontCamera((prev) => !prev);
      }
    }
  };

  const handleSendChat = () => {
    if (!chatText.trim()) return;
    socketRef.current?.emit("meeting:chat", {
      meetingId,
      userId: currentUserRef.current?.id || "",
      sender: currentUserRef.current?.fullName || "Khách di động",
      message: chatText.trim(),
    });
    setChatText("");
  };

  const cleanup = () => {
    // Dừng luồng media cục bộ
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach((track) => track.stop());
      localStreamRef.current = null;
    }
    setLocalStream(null);

    // Đóng tất cả Peer Connections
    peersRef.current.forEach((pc) => pc.close());
    peersRef.current.clear();
    setRemoteFeeds([]);

    // Ngắt kết nối socket
    if (socketRef.current) {
      socketRef.current.disconnect();
      socketRef.current = null;
    }
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#6366f1" />
        <Text style={styles.loadingText}>Đang thiết lập camera và âm thanh...</Text>
      </View>
    );
  }

  // Giao diện phòng chờ đồng hành
  if (isWaiting) {
    return (
      <SafeAreaView style={styles.waitingContainer}>
        <View style={styles.waitingCard}>
          <View style={styles.radarContainer}>
            <View style={[styles.radarCircle, styles.radar1]} />
            <View style={[styles.radarCircle, styles.radar2]} />
            <View style={[styles.radarCircle, styles.radar3]} />
            <View style={styles.radarIcon}>
              <Text style={{ fontSize: 28 }}>📹</Text>
            </View>
          </View>
          <Text style={styles.waitingTitle}>Phòng Chờ Cuộc Họp</Text>
          <Text style={styles.waitingSubtitle}>
            Vui lòng đợi một lát. Người tổ chức cuộc họp đang duyệt yêu cầu tham gia của bạn.
          </Text>

          <View style={styles.waitingInfoBox}>
            <Text style={styles.infoBoxText}>
              <Text style={{ fontWeight: "700" }}>Cuộc họp: </Text>
              {meetingData?.title || meetingId}
            </Text>
            <Text style={[styles.infoBoxText, { marginTop: 8 }]}>
              <Text style={{ fontWeight: "700" }}>Trạng thái: </Text>
              Đang chờ duyệt...
            </Text>
          </View>

          <TouchableOpacity
            style={styles.cancelWaitingBtn}
            onPress={() => {
              cleanup();
              navigation.goBack();
            }}
          >
            <Text style={styles.cancelWaitingText}>Rời phòng chờ</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.roomContainer}>
      {/* Video Grid */}
      <View style={styles.videoGrid}>
        {/* Local Stream (Tọa độ nhỏ góc trên bên phải hoặc grid nếu ít người) */}
        {localStream && cameraOn ? (
          <View style={styles.localVideoWrapper}>
            <RTCView
              streamURL={localStream.toURL()}
              objectFit="cover"
              style={styles.localVideo}
            />
            <Text style={styles.videoName}>Bạn (Cá nhân)</Text>
          </View>
        ) : (
          <View style={[styles.localVideoWrapper, styles.videoPlaceholder]}>
            <Text style={styles.placeholderAvatar}>
              {(currentUserRef.current?.fullName || "U")[0].toUpperCase()}
            </Text>
            <Text style={styles.videoName}>Bạn (Tắt Cam)</Text>
          </View>
        )}

        {/* Remote Streams */}
        {remoteFeeds.map((feed) => (
          <View key={feed.socketId} style={styles.remoteVideoWrapper}>
            {feed.stream && feed.cameraOn ? (
              <RTCView
                streamURL={feed.stream.toURL()}
                objectFit="cover"
                style={styles.remoteVideo}
              />
            ) : (
              <View style={[styles.remoteVideo, styles.videoPlaceholder]}>
                <Text style={styles.placeholderAvatar}>{feed.name[0].toUpperCase()}</Text>
              </View>
            )}
            <Text style={styles.videoName}>
              {feed.name} {!feed.micOn ? "🔇" : ""}
            </Text>
          </View>
        ))}

        {remoteFeeds.length === 0 && (
          <View style={styles.aloneContainer}>
            <Text style={styles.aloneText}>Chưa có thành viên khác tham gia...</Text>
          </View>
        )}
      </View>

      {/* Bottom Control Bar */}
      <View style={styles.controlsBar}>
        <TouchableOpacity
          style={[styles.controlBtn, !micOn && styles.controlBtnOff]}
          onPress={toggleMic}
        >
          <Text style={styles.controlIcon}>{micOn ? "🎙️" : "🔇"}</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.controlBtn, !cameraOn && styles.controlBtnOff]}
          onPress={toggleCamera}
        >
          <Text style={styles.controlIcon}>{cameraOn ? "📹" : "📷"}</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.controlBtn} onPress={switchCamera}>
          <Text style={styles.controlIcon}>🔄</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.controlBtn} onPress={() => setShowChat(true)}>
          <Text style={styles.controlIcon}>💬</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.controlBtn, styles.leaveBtn]}
          onPress={() => {
            cleanup();
            navigation.goBack();
          }}
        >
          <Text style={styles.controlIcon}>📞</Text>
        </TouchableOpacity>
      </View>

      {/* Chat Overlay Modal */}
      <Modal visible={showChat} animationType="slide" transparent>
        <SafeAreaView style={styles.chatModalContainer}>
          <KeyboardAvoidingView
            behavior={Platform.OS === "ios" ? "padding" : "height"}
            style={{ flex: 1 }}
          >
            <View style={styles.chatHeader}>
              <Text style={styles.chatTitle}>Tin nhắn cuộc họp</Text>
              <TouchableOpacity onPress={() => setShowChat(false)} style={styles.closeChatBtn}>
                <Text style={styles.closeChatText}>Đóng</Text>
              </TouchableOpacity>
            </View>

            <FlatList
              data={chatMessages}
              keyExtractor={(_, index) => index.toString()}
              contentContainerStyle={{ padding: 16 }}
              renderItem={({ item }) => (
                <View style={styles.chatMsgRow}>
                  <Text style={styles.chatMsgSender}>{item.sender}</Text>
                  <View style={styles.chatMsgBubble}>
                    <Text style={styles.chatMsgText}>{item.message}</Text>
                  </View>
                </View>
              )}
              ListEmptyComponent={
                <View style={{ alignItems: "center", marginTop: 40 }}>
                  <Text style={{ color: "#475569" }}>Chưa có tin nhắn nào.</Text>
                </View>
              }
            />

            <View style={styles.chatInputRow}>
              <TextInput
                style={styles.chatInput}
                placeholder="Nhập tin nhắn..."
                placeholderTextColor="#475569"
                value={chatText}
                onChangeText={setChatText}
              />
              <TouchableOpacity style={styles.sendChatBtn} onPress={handleSendChat}>
                <Text style={{ color: "#ffffff", fontWeight: "700" }}>Gửi</Text>
              </TouchableOpacity>
            </View>
          </KeyboardAvoidingView>
        </SafeAreaView>
      </Modal>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  loadingContainer: {
    flex: 1,
    backgroundColor: "#0f1117",
    justifyContent: "center",
    alignItems: "center",
  },
  loadingText: {
    color: "#94a3b8",
    marginTop: 16,
    fontSize: 14,
  },
  waitingContainer: {
    flex: 1,
    backgroundColor: "#07090e",
    alignItems: "center",
    justifyContent: "center",
  },
  waitingCard: {
    backgroundColor: "rgba(26, 29, 39, 0.5)",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.08)",
    borderRadius: 24,
    width: Dimensions.get("window").width * 0.88,
    padding: 32,
    alignItems: "center",
  },
  radarContainer: {
    width: 120,
    height: 120,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 20,
  },
  radarCircle: {
    position: "absolute",
    width: "100%",
    height: "100%",
    borderRadius: 60,
    backgroundColor: "#6366f1",
    opacity: 0.15,
  },
  radar1: {
    transform: [{ scale: 0.7 }],
  },
  radar2: {
    transform: [{ scale: 1.1 }],
  },
  radar3: {
    transform: [{ scale: 1.5 }],
  },
  radarIcon: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: "#6366f1",
    justifyContent: "center",
    alignItems: "center",
    shadowColor: "#6366f1",
    shadowRadius: 10,
    shadowOpacity: 0.3,
    elevation: 6,
  },
  waitingTitle: {
    fontSize: 20,
    fontWeight: "800",
    color: "#ffffff",
    marginBottom: 8,
  },
  waitingSubtitle: {
    fontSize: 13,
    color: "#94a3b8",
    textAlign: "center",
    lineHeight: 18,
    marginBottom: 24,
  },
  waitingInfoBox: {
    backgroundColor: "rgba(255, 255, 255, 0.03)",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.05)",
    borderRadius: 12,
    padding: 16,
    width: "100%",
    marginBottom: 28,
  },
  infoBoxText: {
    color: "#f1f5f9",
    fontSize: 13,
  },
  cancelWaitingBtn: {
    backgroundColor: "rgba(255, 255, 255, 0.04)",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.1)",
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 24,
    width: "100%",
    alignItems: "center",
  },
  cancelWaitingText: {
    color: "#ef4444",
    fontWeight: "700",
    fontSize: 14,
  },
  roomContainer: {
    flex: 1,
    backgroundColor: "#090b0f",
  },
  videoGrid: {
    flex: 1,
    padding: 12,
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
    alignContent: "flex-start",
    gap: 12,
  },
  localVideoWrapper: {
    width: "48%",
    height: 180,
    backgroundColor: "#161824",
    borderRadius: 16,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.06)",
  },
  localVideo: {
    width: "100%",
    height: "100%",
  },
  remoteVideoWrapper: {
    width: "48%",
    height: 180,
    backgroundColor: "#161824",
    borderRadius: 16,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.06)",
  },
  remoteVideo: {
    width: "100%",
    height: "100%",
  },
  videoPlaceholder: {
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#1c1f30",
  },
  placeholderAvatar: {
    fontSize: 32,
    fontWeight: "800",
    color: "#6366f1",
  },
  videoName: {
    position: "absolute",
    bottom: 8,
    left: 8,
    backgroundColor: "rgba(0, 0, 0, 0.6)",
    color: "#ffffff",
    paddingVertical: 3,
    paddingHorizontal: 8,
    borderRadius: 6,
    fontSize: 11,
    fontWeight: "600",
  },
  aloneContainer: {
    position: "absolute",
    width: "100%",
    height: "100%",
    alignItems: "center",
    justifyContent: "center",
  },
  aloneText: {
    color: "#475569",
    fontSize: 14,
  },
  controlsBar: {
    height: 80,
    backgroundColor: "#131520",
    flexDirection: "row",
    justifyContent: "space-evenly",
    alignItems: "center",
    borderTopWidth: 1,
    borderTopColor: "rgba(255,255,255,0.05)",
  },
  controlBtn: {
    width: 46,
    height: 46,
    borderRadius: 23,
    backgroundColor: "#222538",
    justifyContent: "center",
    alignItems: "center",
  },
  controlBtnOff: {
    backgroundColor: "#ef4444",
  },
  leaveBtn: {
    backgroundColor: "#dc2626",
    width: 54,
    height: 54,
    borderRadius: 27,
  },
  controlIcon: {
    fontSize: 20,
    color: "#ffffff",
  },
  chatModalContainer: {
    flex: 1,
    backgroundColor: "#0f1117",
  },
  chatHeader: {
    height: 56,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(255,255,255,0.08)",
    backgroundColor: "#1a1d27",
  },
  chatTitle: {
    color: "#ffffff",
    fontSize: 16,
    fontWeight: "700",
  },
  closeChatBtn: {
    padding: 6,
  },
  closeChatText: {
    color: "#6366f1",
    fontSize: 14,
    fontWeight: "600",
  },
  chatMsgRow: {
    marginBottom: 16,
    alignItems: "flex-start",
  },
  chatMsgSender: {
    color: "#94a3b8",
    fontSize: 11,
    marginBottom: 4,
    fontWeight: "500",
  },
  chatMsgBubble: {
    backgroundColor: "#22263a",
    borderRadius: 14,
    paddingVertical: 10,
    paddingHorizontal: 14,
    maxWidth: "80%",
  },
  chatMsgText: {
    color: "#f1f5f9",
    fontSize: 14,
  },
  chatInputRow: {
    flexDirection: "row",
    padding: 12,
    borderTopWidth: 1,
    borderTopColor: "rgba(255,255,255,0.08)",
    backgroundColor: "#131520",
    alignItems: "center",
  },
  chatInput: {
    flex: 1,
    backgroundColor: "#22263a",
    borderRadius: 12,
    color: "#ffffff",
    paddingHorizontal: 16,
    paddingVertical: 10,
    marginRight: 12,
    fontSize: 14,
  },
  sendChatBtn: {
    backgroundColor: "#6366f1",
    borderRadius: 12,
    paddingVertical: 10,
    paddingHorizontal: 16,
  },
});
