import React, { useEffect, useState, useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
  ActivityIndicator,
  FlatList,
  Alert,
} from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { StackNavigationProp } from "@react-navigation/stack";
import { useNavigation, useFocusEffect } from "@react-navigation/native";
import { RootStackParamList } from "../../App";
import { http } from "../api/http";

type DashboardScreenNavigationProp = StackNavigationProp<RootStackParamList, "Dashboard">;

export const DashboardScreen = () => {
  const navigation = useNavigation<DashboardScreenNavigationProp>();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [data, setData] = useState<any>(null);
  const [activeTab, setActiveTab] = useState<"meetings" | "tasks" | "notifications">("meetings");

  const fetchDashboardData = async () => {
    try {
      const response = await http.get("/dashboard");
      setData(response.data);
    } catch (err) {
      console.error("Lỗi khi tải dữ liệu dashboard:", err);
      Alert.alert("Lỗi", "Không thể kết nối đến máy chủ. Vui lòng kiểm tra IP máy chủ.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  // Tải lại dữ liệu khi màn hình được focus (quay lại từ các trang khác)
  useFocusEffect(
    useCallback(() => {
      fetchDashboardData();
    }, [])
  );

  const onRefresh = () => {
    setRefreshing(true);
    fetchDashboardData();
  };

  const handleLogout = async () => {
    Alert.alert("Đăng xuất", "Bạn có chắc chắn muốn đăng xuất?", [
      { text: "Hủy", style: "cancel" },
      {
        text: "Đồng ý",
        style: "destructive",
        onPress: async () => {
          await AsyncStorage.removeItem("token");
          navigation.replace("Login");
        },
      },
    ]);
  };

  // Cấu hình header bên phải: Nút Đăng xuất
  useEffect(() => {
    navigation.setOptions({
      headerRight: () => (
        <TouchableOpacity style={styles.logoutButton} onPress={handleLogout}>
          <Text style={styles.logoutText}>Đăng xuất</Text>
        </TouchableOpacity>
      ),
    });
  }, [navigation]);

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#6366f1" />
        <Text style={styles.loadingText}>Đang tải dữ liệu...</Text>
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
    return map[category] || "Cuộc họp";
  };

  const formatTime = (isoString: string) => {
    const date = new Date(isoString);
    return date.toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit" }) + " - " + date.toLocaleDateString("vi-VN", { day: "2-digit", month: "2-digit" });
  };

  const renderMeetingCard = ({ item, isLive }: { item: any; isLive?: boolean }) => {
    const hostName = item.ownerId?.fullName || "Không rõ host";
    return (
      <TouchableOpacity
        key={item._id}
        style={[styles.meetingCard, isLive && styles.liveCard]}
        onPress={() => navigation.navigate("MeetingDetail", { meetingId: item._id })}
      >
        <View style={styles.cardHeader}>
          <Text style={styles.meetingTitle} numberOfLines={1}>
            {item.title}
          </Text>
          <View style={[styles.badge, isLive ? styles.badgeLive : styles.badgeUpcoming]}>
            <Text style={styles.badgeText}>{isLive ? "Đang diễn ra" : "Sắp diễn ra"}</Text>
          </View>
        </View>

        <Text style={styles.cardInfo}>🕒 {formatTime(item.startTime)}</Text>
        <Text style={styles.cardInfo}>👤 Host: {hostName}</Text>
        <Text style={styles.cardInfo}>🏷️ Thể loại: {getCategoryLabel(item.category)}</Text>
      </TouchableOpacity>
    );
  };

  return (
    <View style={styles.container}>
      {/* Tab Selector Segment */}
      <View style={styles.tabContainer}>
        <TouchableOpacity
          style={[styles.tabButton, activeTab === "meetings" && styles.activeTabButton]}
          onPress={() => setActiveTab("meetings")}
        >
          <Text style={[styles.tabText, activeTab === "meetings" && styles.activeTabText]}>
            Cuộc Họp
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tabButton, activeTab === "tasks" && styles.activeTabButton]}
          onPress={() => setActiveTab("tasks")}
        >
          <Text style={[styles.tabText, activeTab === "tasks" && styles.activeTabText]}>
            Công Việc
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tabButton, activeTab === "notifications" && styles.activeTabButton]}
          onPress={() => setActiveTab("notifications")}
        >
          <Text style={[styles.tabText, activeTab === "notifications" && styles.activeTabText]}>
            Thông Báo
          </Text>
        </TouchableOpacity>
      </View>

      {/* Main Content Area */}
      <ScrollView
        contentContainerStyle={styles.scrollContainer}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#6366f1" />}
      >
        {activeTab === "meetings" && (
          <View>
            {/* Ongoing Meetings */}
            <Text style={styles.sectionTitle}>🔴 Cuộc họp đang diễn ra</Text>
            {data?.ongoingMeetings && data.ongoingMeetings.length > 0 ? (
              data.ongoingMeetings.map((item: any) => renderMeetingCard({ item, isLive: true }))
            ) : (
              <View style={styles.emptyCard}>
                <Text style={styles.emptyText}>Không có cuộc họp nào đang diễn ra.</Text>
              </View>
            )}

            {/* Upcoming Meetings */}
            <Text style={[styles.sectionTitle, { marginTop: 24 }]}>📅 Cuộc họp sắp diễn ra</Text>
            {data?.upcomingMeetings && data.upcomingMeetings.length > 0 ? (
              data.upcomingMeetings.map((item: any) => renderMeetingCard({ item, isLive: false }))
            ) : (
              <View style={styles.emptyCard}>
                <Text style={styles.emptyText}>Không có lịch họp sắp tới.</Text>
              </View>
            )}

            {/* Invitations */}
            {data?.invitations && data.invitations.length > 0 && (
              <View>
                <Text style={[styles.sectionTitle, { marginTop: 24 }]}>✉️ Lời mời họp mới ({data.invitations.length})</Text>
                {data.invitations.map((inv: any) => {
                  const meeting = inv.meetingId;
                  if (!meeting) return null;
                  return (
                    <TouchableOpacity
                      key={inv._id}
                      style={[styles.meetingCard, styles.inviteCard]}
                      onPress={() => navigation.navigate("MeetingDetail", { meetingId: meeting._id, invitationId: inv._id })}
                    >
                      <View style={styles.cardHeader}>
                        <Text style={styles.meetingTitle} numberOfLines={1}>{meeting.title}</Text>
                        <View style={[styles.badge, styles.badgePending]}>
                          <Text style={styles.badgeText}>Lời mời</Text>
                        </View>
                      </View>
                      <Text style={styles.cardInfo}>🕒 {formatTime(meeting.startTime)}</Text>
                      <Text style={styles.cardInfo}>👤 Gửi từ: {meeting.ownerId?.fullName || "Chủ phòng"}</Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            )}
          </View>
        )}

        {activeTab === "tasks" && (
          <View>
            <Text style={styles.sectionTitle}>📋 Danh sách công việc của bạn</Text>
            {data?.tasks && data.tasks.length > 0 ? (
              data.tasks.map((task: any) => (
                <View key={task._id} style={styles.taskCard}>
                  <View style={styles.taskHeader}>
                    <Text style={styles.taskTitle}>{task.title}</Text>
                    <View style={[styles.badge, task.status === "completed" ? styles.badgeLive : styles.badgePending]}>
                      <Text style={styles.badgeText}>
                        {task.status === "completed" ? "Đã xong" : "Đang làm"}
                      </Text>
                    </View>
                  </View>
                  {task.description ? (
                    <Text style={styles.taskDesc}>{task.description}</Text>
                  ) : null}
                  {task.dueDate ? (
                    <Text style={styles.taskTime}>📅 Hạn chót: {formatTime(task.dueDate)}</Text>
                  ) : null}
                </View>
              ))
            ) : (
              <View style={styles.emptyCard}>
                <Text style={styles.emptyText}>Bạn chưa có công việc nào được giao.</Text>
              </View>
            )}
          </View>
        )}

        {activeTab === "notifications" && (
          <View>
            <Text style={styles.sectionTitle}>🔔 Thông báo gần đây</Text>
            {data?.notifications && data.notifications.length > 0 ? (
              data.notifications.map((notif: any) => (
                <View key={notif._id} style={styles.notificationCard}>
                  <Text style={styles.notificationTitle}>{notif.title}</Text>
                  <Text style={styles.notificationContent}>{notif.content}</Text>
                  <Text style={styles.notificationTime}>
                    {new Date(notif.createdAt).toLocaleString("vi-VN")}
                  </Text>
                </View>
              ))
            ) : (
              <View style={styles.emptyCard}>
                <Text style={styles.emptyText}>Hộp thư thông báo trống.</Text>
              </View>
            )}
          </View>
        )}
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#0f1117",
  },
  loadingContainer: {
    flex: 1,
    backgroundColor: "#0f1117",
    justifyContent: "center",
    alignItems: "center",
  },
  loadingText: {
    color: "#94a3b8",
    marginTop: 12,
    fontSize: 14,
  },
  logoutButton: {
    marginRight: 16,
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 8,
    backgroundColor: "rgba(239, 68, 68, 0.1)",
    borderWidth: 1,
    borderColor: "rgba(239, 68, 68, 0.2)",
  },
  logoutText: {
    color: "#ef4444",
    fontSize: 13,
    fontWeight: "600",
  },
  tabContainer: {
    flexDirection: "row",
    backgroundColor: "#1a1d27",
    borderBottomWidth: 1,
    borderBottomColor: "rgba(255, 255, 255, 0.08)",
    paddingVertical: 12,
    paddingHorizontal: 16,
  },
  tabButton: {
    flex: 1,
    alignItems: "center",
    paddingVertical: 8,
    borderRadius: 8,
  },
  activeTabButton: {
    backgroundColor: "#22263a",
  },
  tabText: {
    fontSize: 14,
    fontWeight: "600",
    color: "#94a3b8",
  },
  activeTabText: {
    color: "#6366f1",
  },
  scrollContainer: {
    padding: 16,
  },
  sectionTitle: {
    fontSize: 15,
    fontWeight: "700",
    color: "#f1f5f9",
    marginBottom: 12,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  meetingCard: {
    backgroundColor: "#1a1d27",
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.06)",
    padding: 16,
    marginBottom: 12,
  },
  liveCard: {
    borderColor: "rgba(34, 197, 94, 0.3)",
    backgroundColor: "rgba(34, 197, 94, 0.02)",
  },
  inviteCard: {
    borderColor: "rgba(99, 102, 241, 0.3)",
    backgroundColor: "rgba(99, 102, 241, 0.02)",
  },
  cardHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 12,
  },
  meetingTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: "#f1f5f9",
    flex: 1,
    marginRight: 8,
  },
  badge: {
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: 6,
  },
  badgeLive: {
    backgroundColor: "rgba(34, 197, 94, 0.15)",
  },
  badgeUpcoming: {
    backgroundColor: "rgba(56, 189, 248, 0.15)",
  },
  badgePending: {
    backgroundColor: "rgba(245, 158, 11, 0.15)",
  },
  badgeText: {
    fontSize: 11,
    fontWeight: "600",
    color: "#ffffff",
  },
  cardInfo: {
    fontSize: 13,
    color: "#94a3b8",
    marginBottom: 6,
  },
  emptyCard: {
    backgroundColor: "#1a1d27",
    borderRadius: 12,
    padding: 20,
    alignItems: "center",
    borderStyle: "dashed",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.1)",
  },
  emptyText: {
    color: "#475569",
    fontSize: 13,
  },
  taskCard: {
    backgroundColor: "#1a1d27",
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderLeftWidth: 3,
    borderLeftColor: "#6366f1",
  },
  taskHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 8,
  },
  taskTitle: {
    fontSize: 15,
    fontWeight: "700",
    color: "#f1f5f9",
    flex: 1,
    marginRight: 8,
  },
  taskDesc: {
    fontSize: 13,
    color: "#94a3b8",
    marginBottom: 8,
  },
  taskTime: {
    fontSize: 11,
    color: "#475569",
  },
  notificationCard: {
    backgroundColor: "#1a1d27",
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderLeftWidth: 3,
    borderLeftColor: "#38bdf8",
  },
  notificationTitle: {
    fontSize: 14,
    fontWeight: "700",
    color: "#f1f5f9",
    marginBottom: 6,
  },
  notificationContent: {
    fontSize: 13,
    color: "#94a3b8",
    marginBottom: 8,
  },
  notificationTime: {
    fontSize: 11,
    color: "#475569",
  },
});
