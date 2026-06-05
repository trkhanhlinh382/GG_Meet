import React, { useEffect, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
} from "react-native";
import { RouteProp, useRoute, useNavigation } from "@react-navigation/native";
import { StackNavigationProp } from "@react-navigation/stack";
import { RootStackParamList } from "../../App";
import { http } from "../api/http";

type MeetingDetailScreenRouteProp = RouteProp<RootStackParamList, "MeetingDetail">;
type MeetingDetailScreenNavigationProp = StackNavigationProp<RootStackParamList, "MeetingDetail">;

export const MeetingDetailScreen = () => {
  const route = useRoute<MeetingDetailScreenRouteProp>();
  const navigation = useNavigation<MeetingDetailScreenNavigationProp>();
  const { meetingId, invitationId: initialInvitationId } = route.params;

  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [meeting, setMeeting] = useState<any>(null);
  const [invitationId, setInvitationId] = useState<string | null>(initialInvitationId || null);
  const [invitationStatus, setInvitationStatus] = useState<string | null>(null);
  const [members, setMembers] = useState<any[]>([]);

  const fetchDetails = async () => {
    try {
      if (invitationId) {
        // Trường hợp truy cập từ thông báo/lời mời: Fetch thông tin thư mời trước
        const response = await http.get(`/invitations/${invitationId}`);
        const invData = response.data;
        setMeeting(invData.meetingId);
        setInvitationStatus(invData.status);
      } else {
        // Trường hợp truy cập bình thường: Fetch chi tiết cuộc họp
        const response = await http.get(`/meetings/${meetingId}/details`);
        const details = response.data;
        setMeeting(details.meeting);
        setMembers(details.invitations || []);

        // Tìm xem người dùng hiện tại có thư mời nào trong danh sách không
        // (để lấy được status & invitationId nếu có)
        // Lưu ý: backend details.invitations chứa thông tin { _id, status, userId: { _id, email } }
        const profileResponse = await http.get("/dashboard");
        const currentUserEmail = profileResponse.data?.tasks?.[0]?.assigneeId?.email; // Cách lấy email tạm thời từ task hoặc tự decode token, tốt nhất là khớp ID
        // Tuy nhiên, nếu user đã tham gia bình thường thì status được xem như accepted/owner
      }
    } catch (err: any) {
      console.error("Lỗi khi tải chi tiết cuộc họp:", err);
      // Nếu bị 403 Forbidden do chưa accept, thử gọi API lấy thông tin cơ bản
      try {
        const basicResponse = await http.get(`/meetings/${meetingId}`);
        setMeeting(basicResponse.data);
      } catch (basicErr) {
        Alert.alert("Lỗi", "Không thể lấy thông tin cuộc họp. Bạn không có quyền truy cập.");
        navigation.goBack();
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDetails();
  }, [meetingId, invitationId]);

  const handleInvitation = async (action: "accept" | "reject") => {
    if (!invitationId) return;
    setActionLoading(true);
    try {
      await http.post(`/invitations/${invitationId}/${action}`);
      Alert.alert("Thành công", action === "accept" ? "Đã chấp nhận lời mời họp." : "Đã từ chối lời mời họp.");
      if (action === "accept") {
        setInvitationStatus("accepted");
        // Reset lại để tải đầy đủ chi tiết cuộc họp (lúc này đã là thành viên)
        setInvitationId(null);
        fetchDetails();
      } else {
        navigation.goBack();
      }
    } catch (err: any) {
      Alert.alert("Lỗi", err?.response?.data?.message || "Không thể thực hiện yêu cầu.");
    } finally {
      setActionLoading(false);
    }
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#6366f1" />
      </View>
    );
  }

  if (!meeting) {
    return (
      <View style={styles.errorContainer}>
        <Text style={styles.errorText}>Không tìm thấy thông tin cuộc họp.</Text>
      </View>
    );
  }

  const getCategoryLabel = (category: string) => {
    const map: Record<string, string> = {
      personal: "Cá nhân",
      interview: "Phỏng vấn",
      team_meeting: "Họp nhóm",
      client_meeting: "Khách hàng",
      training: "Đào tạo",
    };
    return map[category] || "Cuộc họp trực tuyến";
  };

  const formatTime = (isoString: string) => {
    const date = new Date(isoString);
    return date.toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit" }) + " ngày " + date.toLocaleDateString("vi-VN", { day: "2-digit", month: "2-digit", year: "numeric" });
  };

  const isLive = meeting.status === "live";
  const hostName = meeting.ownerId?.fullName || "Không rõ host";
  const hostEmail = meeting.ownerId?.email || "";

  return (
    <ScrollView contentContainerStyle={styles.container}>
      {/* Title & Category Badge */}
      <View style={styles.headerCard}>
        <Text style={styles.title}>{meeting.title}</Text>
        <View style={styles.badgeRow}>
          <View style={[styles.badge, isLive ? styles.badgeLive : styles.badgeUpcoming]}>
            <Text style={styles.badgeText}>{isLive ? "ĐANG DIỄN RA" : "CHƯA BẮT ĐẦU"}</Text>
          </View>
          <View style={[styles.badge, styles.badgeCategory]}>
            <Text style={styles.badgeText}>{getCategoryLabel(meeting.category).toUpperCase()}</Text>
          </View>
        </View>
      </View>

      {/* Info Details List */}
      <View style={styles.card}>
        <Text style={styles.sectionTitle}>Thông tin chi tiết</Text>

        <View style={styles.infoRow}>
          <Text style={styles.infoLabel}>🕒 Bắt đầu:</Text>
          <Text style={styles.infoValue}>{formatTime(meeting.startTime)}</Text>
        </View>
        <View style={styles.infoRow}>
          <Text style={styles.infoLabel}>🕒 Kết thúc:</Text>
          <Text style={styles.infoValue}>{formatTime(meeting.endTime)}</Text>
        </View>
        <View style={styles.infoRow}>
          <Text style={styles.infoLabel}>👤 Người tổ chức:</Text>
          <Text style={styles.infoValue}>{hostName} {hostEmail ? `(${hostEmail})` : ""}</Text>
        </View>
        <View style={styles.infoRow}>
          <Text style={styles.infoLabel}>🔒 Chế độ:</Text>
          <Text style={styles.infoValue}>
            {meeting.privacyMode === "private" ? "Riêng tư (Chỉ khách mời)" : "Công khai (Bất kỳ ai)"}
          </Text>
        </View>
        <View style={styles.infoRow}>
          <Text style={styles.infoLabel}>🚪 Phòng chờ:</Text>
          <Text style={styles.infoValue}>
            {meeting.waitingRoomEnabled ? "Bật (Host duyệt vào phòng)" : "Tắt (Vào thẳng phòng)"}
          </Text>
        </View>
      </View>

      {/* Description Card */}
      {meeting.description ? (
        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Mô tả cuộc họp</Text>
          <Text style={styles.descText}>{meeting.description}</Text>
        </View>
      ) : null}

      {/* Members List Card (Chỉ hiển thị khi đã tham gia thành công vào details) */}
      {members.length > 0 && (
        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Khách mời ({members.length})</Text>
          {members.map((member) => (
            <View key={member._id} style={styles.memberRow}>
              <View style={styles.memberAvatar}>
                <Text style={styles.avatarText}>{(member.userId?.fullName || "U")[0].toUpperCase()}</Text>
              </View>
              <View style={styles.memberInfo}>
                <Text style={styles.memberName}>{member.userId?.fullName || "Khách mời"}</Text>
                <Text style={styles.memberEmail}>{member.userId?.email || ""}</Text>
              </View>
              <View style={[styles.statusBadge, member.status === "accepted" ? styles.statusAccepted : styles.statusPending]}>
                <Text style={styles.statusText}>
                  {member.status === "accepted" ? "Đã nhận" : "Đang chờ"}
                </Text>
              </View>
            </View>
          ))}
        </View>
      )}

      {/* Action Buttons */}
      <View style={styles.actionContainer}>
        {invitationStatus === "pending" && invitationId ? (
          <View style={styles.inviteButtonsRow}>
            <TouchableOpacity
              style={[styles.actionButton, styles.rejectButton]}
              onPress={() => handleInvitation("reject")}
              disabled={actionLoading}
            >
              {actionLoading ? <ActivityIndicator color="#ffffff" /> : <Text style={styles.buttonText}>Từ Chối</Text>}
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.actionButton, styles.acceptButton]}
              onPress={() => handleInvitation("accept")}
              disabled={actionLoading}
            >
              {actionLoading ? <ActivityIndicator color="#ffffff" /> : <Text style={styles.buttonText}>Chấp Nhận</Text>}
            </TouchableOpacity>
          </View>
        ) : (
          <TouchableOpacity
            style={[styles.actionButton, styles.joinButton]}
            onPress={() => navigation.navigate("MeetingRoom", { meetingId: meeting._id })}
          >
            <Text style={styles.buttonText}>Tham Gia Cuộc Họp</Text>
          </TouchableOpacity>
        )}
      </View>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    padding: 16,
    backgroundColor: "#0f1117",
  },
  loadingContainer: {
    flex: 1,
    backgroundColor: "#0f1117",
    justifyContent: "center",
    alignItems: "center",
  },
  errorContainer: {
    flex: 1,
    backgroundColor: "#0f1117",
    justifyContent: "center",
    alignItems: "center",
    padding: 20,
  },
  errorText: {
    color: "#ef4444",
    fontSize: 16,
    fontWeight: "600",
  },
  headerCard: {
    backgroundColor: "#1a1d27",
    borderRadius: 20,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.08)",
    padding: 20,
    marginBottom: 16,
  },
  title: {
    fontSize: 22,
    fontWeight: "800",
    color: "#f1f5f9",
    marginBottom: 12,
  },
  badgeRow: {
    flexDirection: "row",
    gap: 8,
  },
  badge: {
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 8,
  },
  badgeLive: {
    backgroundColor: "rgba(34, 197, 94, 0.15)",
  },
  badgeUpcoming: {
    backgroundColor: "rgba(99, 102, 241, 0.15)",
  },
  badgeCategory: {
    backgroundColor: "rgba(255, 255, 255, 0.08)",
  },
  badgeText: {
    fontSize: 11,
    fontWeight: "700",
    color: "#ffffff",
    letterSpacing: 0.5,
  },
  card: {
    backgroundColor: "#1a1d27",
    borderRadius: 20,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.08)",
    padding: 20,
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: "700",
    color: "#94a3b8",
    marginBottom: 16,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  infoRow: {
    flexDirection: "row",
    marginBottom: 12,
    alignItems: "flex-start",
  },
  infoLabel: {
    width: 130,
    fontSize: 14,
    color: "#94a3b8",
    fontWeight: "500",
  },
  infoValue: {
    flex: 1,
    fontSize: 14,
    color: "#f1f5f9",
    fontWeight: "600",
  },
  descText: {
    fontSize: 14,
    color: "#94a3b8",
    lineHeight: 20,
  },
  memberRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 12,
  },
  memberAvatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "#22263a",
    alignItems: "center",
    justifyContent: "center",
    marginRight: 12,
  },
  avatarText: {
    color: "#6366f1",
    fontSize: 14,
    fontWeight: "700",
  },
  memberInfo: {
    flex: 1,
  },
  memberName: {
    fontSize: 14,
    fontWeight: "600",
    color: "#f1f5f9",
  },
  memberEmail: {
    fontSize: 12,
    color: "#475569",
    marginTop: 2,
  },
  statusBadge: {
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: 6,
  },
  statusAccepted: {
    backgroundColor: "rgba(34, 197, 94, 0.1)",
  },
  statusPending: {
    backgroundColor: "rgba(245, 158, 11, 0.1)",
  },
  statusText: {
    fontSize: 11,
    fontWeight: "600",
    color: "#ffffff",
  },
  actionContainer: {
    marginTop: 8,
    marginBottom: 40,
  },
  inviteButtonsRow: {
    flexDirection: "row",
    gap: 12,
  },
  actionButton: {
    borderRadius: 14,
    height: 52,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 4,
  },
  rejectButton: {
    flex: 1,
    backgroundColor: "#ef4444",
  },
  acceptButton: {
    flex: 1,
    backgroundColor: "#22c55e",
  },
  joinButton: {
    width: "100%",
    backgroundColor: "#6366f1",
    shadowColor: "#6366f1",
    shadowOpacity: 0.3,
  },
  buttonText: {
    color: "#ffffff",
    fontSize: 16,
    fontWeight: "700",
  },
});
