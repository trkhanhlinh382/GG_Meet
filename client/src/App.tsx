import {
  BellOutlined,
  CalendarOutlined,
  ClockCircleOutlined,
  LogoutOutlined,
  ScheduleOutlined,
  ThunderboltOutlined,
  VideoCameraOutlined,
} from "@ant-design/icons";
import type { AxiosError } from "axios";
import {
  Avatar,
  Badge,
  Button,
  Layout,
  List,
  Menu,
  Popover,
  Spin,
  message,
} from "antd";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Navigate,
  Route,
  Routes,
  useLocation,
  useNavigate,
  useParams,
} from "react-router-dom";
import { http, setAuthToken, registerUnauthorizedCallback } from "./api/http";
import type { DashboardPayload, Notification } from "./api/types";
import { fetchNotifications, markNotificationAsRead } from "./api/notifications";
import dayjs from "dayjs";
import relativeTime from "dayjs/plugin/relativeTime";
dayjs.extend(relativeTime);
import { DashboardOverviewPage } from "./pages/DashboardOverviewPage";
import { InvitationDetailPage } from "./pages/InvitationDetailPage";
import { LoginPage } from "./pages/LoginPage";
import { LandingPage } from "./pages/LandingPage";
import { MeetingsPage } from "./pages/MeetingsPage";
import { MeetingDetailPage } from "./pages/MeetingDetailPage.tsx";
import { MeetingRoomPage } from "./pages/MeetingRoomPage.tsx";
import { SchedulePage } from "./pages/SchedulePage";

const { Header, Content, Sider } = Layout;
const SIDER_WIDTH = 220;

// ─── Types ──────────────────────────────────────────────────────────────────

interface SessionUser {
  id: string;
  fullName: string;
  email: string;
}

interface CreateMeetingInput {
  title: string;
  description?: string;
  category: "personal" | "interview" | "team_meeting" | "client_meeting" | "training";
  startTime: string;
  endTime: string;
  privacyMode: "public" | "private";
  waitingRoomEnabled: boolean;
  isInstant?: boolean;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

const getStoredToken = (): string | null => localStorage.getItem("gg_meet_access_token");
const getStoredUser = (): SessionUser | null => {
  const raw = localStorage.getItem("gg_meet_user");
  if (!raw) return null;
  try { return JSON.parse(raw) as SessionUser; } catch { return null; }
};

const decodeJwtPayload = (token: string): Record<string, unknown> | null => {
  try {
    const payload = token.split(".")[1];
    const normalized = payload.replace(/-/g, "+").replace(/_/g, "/");
    return JSON.parse(atob(normalized)) as Record<string, unknown>;
  } catch { return null; }
};

const extractMeetingId = (raw: string): string | null => {
  const trimmed = raw.trim();
  if (!trimmed) return null;
  try {
    const url = new URL(trimmed);
    const segments = url.pathname.split("/").filter(Boolean);
    const roomIndex = segments.lastIndexOf("room");
    if (roomIndex >= 0 && segments[roomIndex + 1]) return segments[roomIndex + 1];
  } catch { /* treat as plain meeting id */ }
  return trimmed;
};

// ─── Room Placeholder ─────────────────────────────────────────────────────────

const RoomPlaceholderRoute = ({
  setActiveCallRoomId,
  setIsCallMinimized,
}: {
  setActiveCallRoomId: (id: string | null) => void;
  setIsCallMinimized: (min: boolean) => void;
}) => {
  const { id } = useParams();
  useEffect(() => {
    if (id) { setActiveCallRoomId(id); setIsCallMinimized(false); }
  }, [id, setActiveCallRoomId, setIsCallMinimized]);

  return (
    <div style={{ display: "flex", flex: 1, height: "100%", alignItems: "center", justifyContent: "center", minHeight: 400 }}>
      <div style={{ textAlign: "center" }}>
        <Spin size="large" />
        <div style={{ marginTop: 16, fontSize: 14, color: "var(--text-secondary)" }}>Đang kết nối vào phòng họp…</div>
      </div>
    </div>
  );
};

// ─── App ──────────────────────────────────────────────────────────────────────

function App() {
  const navigate = useNavigate();
  const location = useLocation();

  const [activeCallRoomId, setActiveCallRoomId] = useState<string | null>(null);
  const [isCallMinimized, setIsCallMinimized] = useState<boolean>(false);
  const [token, setToken] = useState<string | null>(getStoredToken());
  const [user, setUser] = useState<SessionUser | null>(getStoredUser());
  const [dashboard, setDashboard] = useState<DashboardPayload>();
  const [loadingDashboard, setLoadingDashboard] = useState(false);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [notifOpen, setNotifOpen] = useState(false);

  // ─── Session ────────────────────────────────────────────────────────────────

  const clearSession = useCallback(
    (sessionExpired?: boolean) => {
      setAuthToken(undefined);
      setToken(null);
      setUser(null);
      setDashboard(undefined);
      localStorage.removeItem("gg_meet_user");
      if (sessionExpired) void message.warning("Phiên đăng nhập đã hết hạn, vui lòng đăng nhập lại.");
      navigate("/login");
    },
    [navigate],
  );

  useEffect(() => {
    registerUnauthorizedCallback(() => {
      clearSession(true);
    });
  }, [clearSession]);

  // ─── Dashboard fetch ──────────────────────────────────────────────────────

  const fetchDashboard = useCallback(async (): Promise<DashboardPayload | undefined> => {
    if (!token) return undefined;
    try {
      setLoadingDashboard(true);
      const response = await http.get<DashboardPayload>("/dashboard");
      setDashboard(response.data);
      return response.data;
    } catch (error) {
      const axiosError = error as AxiosError<{ message?: string }>;
      if (axiosError.response?.status === 401) { clearSession(true); return undefined; }
      void message.warning("Không tải được dashboard — hãy kiểm tra kết nối API.");
      return undefined;
    } finally {
      setLoadingDashboard(false);
    }
  }, [clearSession, token]);

  // ─── On mount: validate token ─────────────────────────────────────────────

  useEffect(() => {
    const currentToken = getStoredToken();
    if (!currentToken) return;
    const payload = decodeJwtPayload(currentToken);
    const expiresAt = typeof payload?.exp === "number" ? payload.exp * 1000 : null;
    if (expiresAt && expiresAt <= Date.now()) { clearSession(true); return; }
    setAuthToken(currentToken);
    if (!user && typeof payload?.id === "string" && typeof payload?.fullName === "string" && typeof payload?.email === "string") {
      const parsedUser = { id: payload.id, fullName: payload.fullName, email: payload.email };
      setUser(parsedUser);
      localStorage.setItem("gg_meet_user", JSON.stringify(parsedUser));
    }
  }, [clearSession, user]);

  // ─── On token change: fetch dashboard + notifications ─────────────────────

  useEffect(() => {
    if (!token) return;
    void fetchDashboard();
    fetchNotifications().then(setNotifications).catch(() => undefined);
  }, [fetchDashboard, token]);

  // ─── On route change: refresh dashboard data & notifications ─────────────

  useEffect(() => {
    if (!token) return;
    const shouldRefresh =
      location.pathname.startsWith("/dashboard") ||
      location.pathname.startsWith("/meetings") ||
      location.pathname.startsWith("/schedule");
    if (shouldRefresh) {
      void fetchDashboard();
      fetchNotifications().then(setNotifications).catch(() => undefined);
    }
  }, [fetchDashboard, location.pathname, token]);

  // ─── Sidebar active key ────────────────────────────────────────────────────

  const selectedKey = useMemo(() => {
    if (location.pathname.startsWith("/schedule")) return "schedule";
    if (location.pathname.startsWith("/meetings") || location.pathname.startsWith("/room") || location.pathname.startsWith("/invitations")) return "meetings";
    return "dashboard";
  }, [location.pathname]);

  // ─── Auth handlers ─────────────────────────────────────────────────────────

  const handleLogin = (newToken: string, nextUser: SessionUser) => {
    setToken(newToken);
    setUser(nextUser);
    localStorage.setItem("gg_meet_user", JSON.stringify(nextUser));
    navigate("/dashboard");
  };

  // ─── Meeting actions ───────────────────────────────────────────────────────

  const createMeeting = async (input: CreateMeetingInput) => {
    try {
      const response = await http.post("/meetings", input);
      await fetchDashboard();
      const startsAt = new Date(response.data.startTime).getTime();
      if (startsAt > Date.now()) {
        void message.success("Đã tạo cuộc họp. Sẽ nằm ở danh sách Sắp tới.");
        return;
      }
      navigate(`/room/${response.data._id}`);
    } catch (error) {
      const axiosError = error as AxiosError<{ message?: string }>;
      if (axiosError.response?.status === 409) {
        const first = dashboard?.ongoingMeetings?.[0] ?? dashboard?.upcomingMeetings?.[0];
        if (first?._id) {
          void message.info("Trùng lịch — mở room gần nhất.");
          navigate(`/room/${first._id}`);
          return;
        }
        void message.warning("Trùng lịch. Hãy đổi thời gian hoặc vào room đã có.");
        return;
      }
      void message.error("Không thể tạo cuộc họp");
    }
  };

  const joinMeetingById = async (meetingId: string) => {
    try {
      await http.post(`/meetings/${meetingId}/join`, {});
      navigate(`/room/${meetingId}`);
    } catch (error) {
      const axiosError = error as AxiosError<{ message?: string; invitationId?: string }>;
      if (axiosError.response?.status === 404) { void message.error("Link/Meeting ID không tồn tại"); return; }
      if (axiosError.response?.status === 403) {
        const data = axiosError.response.data;
        if (data?.invitationId) { void message.info(data.message || "Vui lòng chấp nhận lời mời."); navigate(`/invitations/${data.invitationId}`); return; }
        void message.error(data?.message || "Cuộc họp riêng tư: chỉ người được mời mới vào được."); return;
      }
      void message.error("Không thể tham gia cuộc họp");
    }
  };

  const joinUpcomingMeeting = async () => {
    const latest = (await fetchDashboard()) ?? dashboard;
    const first = latest?.ongoingMeetings?.[0] ?? latest?.upcomingMeetings?.[0];
    if (!first?._id) { void message.info("Chưa có lịch họp, hãy tạo meeting trước"); return; }
    await joinMeetingById(first._id);
  };

  const joinByLink = async (rawLink: string) => {
    const meetingId = extractMeetingId(rawLink);
    if (!meetingId) { void message.warning("Vui lòng nhập link hoặc Meeting ID"); return; }
    await joinMeetingById(meetingId);
  };

  if (!token) {
    return (
      <Routes>
        <Route path="/" element={<LandingPage />} />
        <Route path="/login" element={<LoginPage onLogin={handleLogin} />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    );
  }

  const unreadCount = notifications.filter((n) => !n.isRead).length;

  // ─── Render ────────────────────────────────────────────────────────────────

  return (
    <Layout style={{ minHeight: "100vh", background: "var(--bg-base)" }}>
      {/* ── Sidebar ─────────────────────────────────────────────────────────── */}
      <Sider
        width={SIDER_WIDTH}
        breakpoint="lg"
        collapsedWidth="0"
        style={{ position: "fixed", left: 0, top: 0, bottom: 0, height: "100vh", zIndex: 1000, overflow: "hidden", background: "var(--bg-surface)", borderRight: "1px solid var(--border)" }}
      >
        <div style={{ display: "flex", flexDirection: "column", height: "100%" }}>
          {/* Brand */}
          <div className="brand">
            <span className="brand-dot" />
            GG Meet
          </div>

          {/* Nav */}
          <div style={{ flex: 1, overflow: "auto", padding: "8px 12px" }}>
            <Menu
              theme="dark"
              mode="inline"
              selectedKeys={[selectedKey]}
              style={{ background: "transparent", border: "none" }}
              onClick={({ key }) => {
                if (key === "dashboard") { navigate("/dashboard"); return; }
                if (key === "schedule")  { navigate("/schedule"); return; }
                if (key === "meetings")  { navigate("/meetings"); return; }
                void joinUpcomingMeeting();
              }}
              items={[
                {
                  key: "dashboard",
                  icon: <CalendarOutlined />,
                  label: "Tổng quan",
                  style: { borderRadius: 8, marginBottom: 2 },
                },
                {
                  key: "schedule",
                  icon: <ScheduleOutlined />,
                  label: "Lịch họp",
                  style: { borderRadius: 8, marginBottom: 2 },
                },
                {
                  key: "meetings",
                  icon: <VideoCameraOutlined />,
                  label: "Cuộc họp",
                  style: { borderRadius: 8, marginBottom: 2 },
                },
              ]}
            />
          </div>

          {/* Quick instant join */}
          <div style={{ padding: "8px 12px" }}>
            <Button
              type="primary"
              icon={<ThunderboltOutlined />}
              block
              style={{ borderRadius: 8, background: "var(--accent)", border: "none", fontWeight: 600 }}
              onClick={() => void joinUpcomingMeeting()}
            >
              Vào họp ngay
            </Button>
          </div>

          {/* User info + logout */}
          <div className="sidebar-user">
            <div className="sidebar-user-avatar">
              {user?.fullName?.charAt(0)?.toUpperCase() ?? "U"}
            </div>
            <div className="sidebar-user-info">
              <div className="sidebar-user-name">{user?.fullName ?? "Người dùng"}</div>
              <div className="sidebar-user-email">{user?.email}</div>
            </div>
            <Button
              type="text"
              size="small"
              icon={<LogoutOutlined />}
              onClick={() => clearSession()}
              style={{ color: "var(--text-muted)", flexShrink: 0 }}
              title="Đăng xuất"
            />
          </div>
        </div>
      </Sider>

      {/* ── Main Layout ──────────────────────────────────────────────────────── */}
      <Layout style={{ marginLeft: SIDER_WIDTH, background: "var(--bg-base)" }}>
        {/* Header */}
        <Header
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            background: "var(--bg-surface)",
            borderBottom: "1px solid var(--border)",
            padding: "0 24px",
            height: 60,
            position: "sticky",
            top: 0,
            zIndex: 100,
          }}
        >
          {/* Left: greeting */}
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <Avatar
              style={{ background: "linear-gradient(135deg, var(--accent), #8b5cf6)", fontWeight: 700, fontSize: 15 }}
            >
              {user?.fullName?.charAt(0)?.toUpperCase() ?? "U"}
            </Avatar>
            <div>
              <div style={{ fontSize: 14, fontWeight: 600, color: "var(--text-primary)", lineHeight: 1.2 }}>
                {user?.fullName ?? "Người dùng"}
              </div>
              <div style={{ fontSize: 11, color: "var(--text-muted)", lineHeight: 1.2 }}>
                {user?.email}
              </div>
            </div>
          </div>

          {/* Right: notifications */}
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <Popover
              open={notifOpen}
              onOpenChange={setNotifOpen}
              placement="bottomRight"
              trigger="click"
              overlayClassName="notif-popover"
              title={
                <div className="notif-title-row">
                  <span className="notif-title-text">Thông báo</span>
                  {unreadCount > 0 && (
                    <Button
                      type="link"
                      className="notif-mark-all-btn"
                      onClick={async () => {
                        await Promise.all(
                          notifications.filter((n) => !n.isRead).map((n) => markNotificationAsRead(n._id))
                        );
                        setNotifications(await fetchNotifications());
                      }}
                    >
                      Đánh dấu tất cả đã đọc
                    </Button>
                  )}
                </div>
              }
              content={
                <List
                  className="notif-list-container"
                  dataSource={notifications}
                  locale={{ emptyText: "Không có thông báo" }}
                  style={{ minWidth: 360, maxHeight: 420, overflowY: "auto" }}
                  renderItem={(item: Notification) => (
                    <List.Item
                      className={`notif-item ${!item.isRead ? "unread" : ""}`}
                      onClick={async () => {
                        if (!item.isRead) {
                          await markNotificationAsRead(item._id);
                          setNotifications(await fetchNotifications());
                        }
                      }}
                      actions={
                        !item.isRead
                          ? [
                              <Button
                                key="mark-read"
                                size="small"
                                className="notif-read-btn"
                                onClick={async (e) => {
                                  e.stopPropagation();
                                  await markNotificationAsRead(item._id);
                                  setNotifications(await fetchNotifications());
                                }}
                              >
                                Đọc
                              </Button>,
                            ]
                          : []
                      }
                    >
                      <div style={{ flex: 1 }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                          {!item.isRead && (
                            <span className="notif-dot" />
                          )}
                          <span className="notif-item-title" style={{ fontWeight: !item.isRead ? 600 : 500 }}>
                            {item.title}
                          </span>
                        </div>
                        <p className="notif-item-content">
                          {item.content}
                        </p>
                        {item.createdAt && (
                          <div className="notif-item-time">
                            <ClockCircleOutlined style={{ fontSize: 10 }} />
                            <span>{dayjs(item.createdAt).fromNow()}</span>
                          </div>
                        )}
                      </div>
                    </List.Item>
                  )}
                />
              }
            >
              <Badge count={unreadCount} size="small" offset={[-2, 2]}>
                <Button
                  shape="circle"
                  icon={<BellOutlined />}
                  style={{ background: "var(--bg-surface-2)", border: "1px solid var(--border)", color: "var(--text-secondary)" }}
                />
              </Badge>
            </Popover>
          </div>
        </Header>

        {/* Content */}
        <Content style={{ padding: "24px", minHeight: "calc(100vh - 60px)" }}>
          {loadingDashboard ? (
            <div className="loading-shell">
              <Spin size="large" />
              <span style={{ color: "var(--text-secondary)", fontSize: 14 }}>Đang tải…</span>
            </div>
          ) : (
            <Routes>
              <Route path="/dashboard" element={<DashboardOverviewPage data={dashboard} onCreateMeeting={createMeeting} onJoinMeeting={joinByLink} />} />
              <Route path="/schedule" element={<SchedulePage />} />
              <Route path="/meetings" element={<MeetingsPage data={dashboard} onCreateMeeting={createMeeting} onJoinMeeting={joinByLink} />} />
              <Route path="/meetings/:id" element={user ? <MeetingDetailPage token={token} user={user} /> : <Navigate to="/login" replace />} />
              <Route path="/invitations/:id" element={user ? <InvitationDetailPage onJoinMeeting={joinByLink} /> : <Navigate to="/login" replace />} />
              <Route path="/room/:id" element={user ? <RoomPlaceholderRoute setActiveCallRoomId={setActiveCallRoomId} setIsCallMinimized={setIsCallMinimized} /> : <Navigate to="/login" replace />} />
              <Route path="*" element={<Navigate to="/dashboard" replace />} />
            </Routes>
          )}
        </Content>
      </Layout>

      {/* ── Floating Meeting Room Overlay ────────────────────────────────────── */}
      {activeCallRoomId && user && token && (
        <div
          style={
            isCallMinimized
              ? {
                  position: "fixed",
                  right: 24,
                  bottom: 24,
                  width: 340,
                  height: 250,
                  zIndex: 9999,
                  background: "rgba(10, 13, 20, 0.97)",
                  borderRadius: "var(--r-xl)",
                  overflow: "hidden",
                  boxShadow: "0 20px 60px rgba(0,0,0,0.7)",
                  border: "1px solid var(--border-strong)",
                  transition: `all var(--dur-slow) var(--ease)`,
                }
              : {
                  position: "fixed",
                  left: 0,
                  top: 0,
                  right: 0,
                  bottom: 0,
                  zIndex: 2000,
                  background: "var(--bg-base)",
                  transition: `all var(--dur-slow) var(--ease)`,
                  overflow: "auto",
                }
          }
        >
          <MeetingRoomPage
            token={token}
            user={user}
            roomId={activeCallRoomId}
            isMinimized={isCallMinimized}
            onMinimize={() => { setIsCallMinimized(true); navigate("/dashboard"); }}
            onMaximize={() => { setIsCallMinimized(false); navigate(`/room/${activeCallRoomId}`); }}
            onLeave={() => { setActiveCallRoomId(null); setIsCallMinimized(false); navigate("/meetings"); }}
          />
        </div>
      )}
    </Layout>
  );
}

export default App;
