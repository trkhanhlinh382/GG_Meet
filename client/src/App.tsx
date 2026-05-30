import { BellOutlined, CalendarOutlined, LogoutOutlined, ScheduleOutlined, VideoCameraOutlined } from "@ant-design/icons";
import type { AxiosError } from "axios";
import { Avatar, Button, Layout, Menu, Spin, Typography, message, Popover, List, Badge } from "antd";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Navigate, Route, Routes, useLocation, useNavigate, useParams } from "react-router-dom";
import { http, setAuthToken } from "./api/http";
import type { DashboardPayload, Notification } from "./api/types";
import { markNotificationAsRead, fetchNotifications } from "./api/notifications";
import dayjs from "dayjs";
import relativeTime from "dayjs/plugin/relativeTime";
dayjs.extend(relativeTime);
import { DashboardOverviewPage } from "./pages/DashboardOverviewPage";
import { InvitationDetailPage } from "./pages/InvitationDetailPage";
import { LoginPage } from "./pages/LoginPage";
import { MeetingsPage } from "./pages/MeetingsPage";
import { MeetingDetailPage } from "./pages/MeetingDetailPage.tsx";
import { MeetingRoomPage } from "./pages/MeetingRoomPage.tsx";
import { SchedulePage } from "./pages/SchedulePage";

const { Header, Content, Sider } = Layout;
const SIDER_WIDTH = 200;

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

const getStoredToken = (): string | null => localStorage.getItem("gg_meet_access_token");
const getStoredUser = (): SessionUser | null => {
  const raw = localStorage.getItem("gg_meet_user");
  if (!raw) {
    return null;
  }

  try {
    return JSON.parse(raw) as SessionUser;
  } catch {
    return null;
  }
};

const decodeJwtPayload = (token: string): Record<string, unknown> | null => {
  try {
    const payload = token.split(".")[1];
    const normalized = payload.replace(/-/g, "+").replace(/_/g, "/");
    return JSON.parse(atob(normalized)) as Record<string, unknown>;
  } catch {
    return null;
  }
};

const extractMeetingId = (raw: string): string | null => {
  const trimmed = raw.trim();
  if (!trimmed) {
    return null;
  }

  try {
    const url = new URL(trimmed);
    const segments = url.pathname.split("/").filter(Boolean);
    const roomIndex = segments.lastIndexOf("room");
    if (roomIndex >= 0 && segments[roomIndex + 1]) {
      return segments[roomIndex + 1];
    }
  } catch {
    // Treat as plain meeting id.
  }

  return trimmed;
};

const RoomPlaceholderRoute = ({ setActiveCallRoomId, setIsCallMinimized }: { setActiveCallRoomId: (id: string | null) => void; setIsCallMinimized: (min: boolean) => void }) => {
  const { id } = useParams();

  useEffect(() => {
    if (id) {
      setActiveCallRoomId(id);
      setIsCallMinimized(false);
    }
  }, [id, setActiveCallRoomId, setIsCallMinimized]);

  return (
    <div style={{ display: "flex", flex: 1, height: "100%", alignItems: "center", justifyContent: "center", background: "#0b0f17", color: "#9ca3af", borderRadius: 12, minHeight: 450 }}>
      <div style={{ textAlign: "center" }}>
        <Spin size="large" />
        <div style={{ marginTop: 16, fontSize: 14 }}>Đang kết nối vào phòng họp...</div>
      </div>
    </div>
  );
};

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

  const clearSession = useCallback(
    (sessionExpired?: boolean) => {
      setAuthToken(undefined);
      setToken(null);
      setUser(null);
      setDashboard(undefined);
      localStorage.removeItem("gg_meet_user");

      if (sessionExpired) {
        void message.warning("Phiên đăng nhập đã hết hạn, vui lòng đăng nhập lại.");
      }

      navigate("/login");
    },
    [navigate],
  );

  const fetchDashboard = useCallback(async (): Promise<DashboardPayload | undefined> => {
    if (!token) {
      return undefined;
    }

    try {
      setLoadingDashboard(true);
      const response = await http.get<DashboardPayload>("/dashboard", {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });
      setDashboard(response.data);
      return response.data;
    } catch (error) {
      const axiosError = error as AxiosError<{ message?: string }>;
      if (axiosError.response?.status === 401) {
        clearSession(true);
        return undefined;
      }

      message.warning("Không tải được dashboard, hãy đảm bảo MongoDB và API đang chạy.");
      return undefined;
    } finally {
      setLoadingDashboard(false);
    }
  }, [clearSession, token]);

  useEffect(() => {
    const currentToken = getStoredToken();
    if (currentToken) {
      const payload = decodeJwtPayload(currentToken);
      const expiresAt = typeof payload?.exp === "number" ? payload.exp * 1000 : null;

      if (expiresAt && expiresAt <= Date.now()) {
        clearSession(true);
        return;
      }

      setAuthToken(currentToken);

      if (!user) {
        if (typeof payload?.id === "string" && typeof payload?.fullName === "string" && typeof payload?.email === "string") {
          const parsedUser = {
            id: payload.id,
            fullName: payload.fullName,
            email: payload.email,
          };
          setUser(parsedUser);
          localStorage.setItem("gg_meet_user", JSON.stringify(parsedUser));
        }
      }
    }
  }, [clearSession, user]);

  useEffect(() => {
    if (!token) {
      return;
    }
    void fetchDashboard();
    fetchNotifications().then(setNotifications);
  }, [fetchDashboard, token]);

  useEffect(() => {
    if (!token) {
      return;
    }

    const shouldRefresh =
      location.pathname.startsWith("/dashboard") ||
      location.pathname.startsWith("/meetings") ||
      location.pathname.startsWith("/schedule");

    if (!shouldRefresh) {
      return;
    }

    void fetchDashboard();
  }, [fetchDashboard, location.pathname, token]);

  const selectedKey = useMemo(() => {
    if (location.pathname.startsWith("/schedule")) {
      return "schedule";
    }

    if (location.pathname.startsWith("/meetings") || location.pathname.startsWith("/room") || location.pathname.startsWith("/invitations")) {
      return "meetings";
    }

    return "dashboard";
  }, [location.pathname]);

  const handleLogin = (newToken: string, nextUser: SessionUser) => {
    setToken(newToken);
    setUser(nextUser);
    localStorage.setItem("gg_meet_user", JSON.stringify(nextUser));
    navigate("/dashboard");
  };

  const handleLogout = () => {
    clearSession();
  };

  const createScheduledMeeting = async (input: CreateMeetingInput) => {
    try {
      const response = await http.post(
        "/meetings",
        input,
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        },
      );

      await fetchDashboard();

      const startsAt = new Date(response.data.startTime).getTime();
      if (startsAt > Date.now()) {
        message.success("Đã tạo meeting trong tương lai. Cuộc họp sẽ nằm ở Upcoming.");
        return;
      }

      navigate(`/room/${response.data._id}`);
    } catch (error) {
      const axiosError = error as AxiosError<{ message?: string }>;

      if (axiosError.response?.status === 409) {
        const first = dashboard?.ongoingMeetings?.[0] ?? dashboard?.upcomingMeetings?.[0];
        if (first?._id) {
          message.info("Bạn đang có meeting trùng lịch, sẽ mở room gần nhất.");
          navigate(`/room/${first._id}`);
          return;
        }

        message.warning("Trùng lịch meeting. Hãy đổi thời gian hoặc vào room đã có.");
        return;
      }

      message.error("Không thể tạo meeting");
    }
  };

  const joinMeetingById = async (meetingId: string) => {
    try {
      await http.post(
        `/meetings/${meetingId}/join`,
        {},
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        },
      );

      navigate(`/room/${meetingId}`);
    } catch (error) {
      const axiosError = error as AxiosError<{ message?: string; invitationId?: string }>;
      if (axiosError.response?.status === 404) {
        message.error("Link/Meeting ID không tồn tại");
        return;
      }

      if (axiosError.response?.status === 403) {
        const data = axiosError.response.data;
        if (data?.invitationId) {
          message.info(data.message || "Vui lòng chấp nhận lời mời để tham gia cuộc họp.");
          navigate(`/invitations/${data.invitationId}`);
          return;
        }
        message.error(data?.message || "Cuộc họp riêng tư: Chỉ người được mời mới có thể tham gia.");
        return;
      }

      message.error("Không thể tham gia cuộc họp từ link");
    }
  };

  const joinUpcomingMeeting = async () => {
    const latest = (await fetchDashboard()) ?? dashboard;
    const first = latest?.ongoingMeetings?.[0] ?? latest?.upcomingMeetings?.[0];
    if (!first?._id) {
      message.info("Chưa có lịch họp sắp tới, hãy tạo meeting trước");
      return;
    }

    await joinMeetingById(first._id);
  };

  const joinByLink = async (rawLink: string) => {
    const meetingId = extractMeetingId(rawLink);

    if (!meetingId) {
      message.warning("Vui lòng nhập link hoặc Meeting ID");
      return;
    }

    await joinMeetingById(meetingId);
  };

  if (!token) {
    return <LoginPage onLogin={handleLogin} />;
  }

  return (
    <Layout style={{ minHeight: "100vh" }}>
      <Sider
        width={SIDER_WIDTH}
        breakpoint="lg"
        collapsedWidth="0"
        style={{
          position: "fixed",
          left: 0,
          top: 0,
          bottom: 0,
          height: "100vh",
          zIndex: 1000,
          overflow: "auto",
        }}
      >
        <div style={{ display: "flex", flexDirection: "column", height: "100%" }}>
          <div className="brand">GG Meet</div>
          <div style={{ flex: 1, overflow: "auto" }}>
            <Menu
              theme="dark"
              mode="inline"
              selectedKeys={[selectedKey]}
              onClick={({ key }) => {
                if (key === "dashboard") {
                  navigate("/dashboard");
                  return;
                }

                if (key === "schedule") {
                  navigate("/schedule");
                  return;
                }

                if (key === "meetings") {
                  navigate("/meetings");
                  return;
                }

                void joinUpcomingMeeting();
              }}
              items={[
                { key: "dashboard", icon: <CalendarOutlined />, label: "Dashboard" },
                { key: "schedule", icon: <ScheduleOutlined />, label: "Schedule" },
                { key: "meetings", icon: <VideoCameraOutlined />, label: "Meeting" },
              ]}
            />
          </div>
          <div style={{ padding: 12, borderTop: "1px solid rgba(255,255,255,0.16)" }}>
            <Button block icon={<LogoutOutlined />} onClick={handleLogout}>
              Logout
            </Button>
          </div>
        </div>
      </Sider>

      <Layout style={{ marginLeft: SIDER_WIDTH }}>
        <Header className="app-header" style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <Avatar>{user?.fullName?.charAt(0) ?? "U"}</Avatar>
            <Typography.Text style={{ color: "white", fontSize: 18 }}>{user?.email ?? "user@ggmeet.dev"}</Typography.Text>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
            <Popover
              placement="bottomRight"
              trigger="click"
              content={
                <List
                  dataSource={notifications}
                  locale={{ emptyText: "Không có thông báo" }}
                  style={{ minWidth: 320, maxHeight: 400, overflow: "auto" }}
                  renderItem={(item: Notification) => (
                    <List.Item
                      actions={
                        !item.isRead
                          ? [
                              <Button
                                key="mark-read"
                                size="small"
                                type="link"
                                onClick={async (e) => {
                                  e.stopPropagation();
                                  await markNotificationAsRead(item._id);
                                  setNotifications(await fetchNotifications());
                                }}
                              >
                                Đã đọc
                              </Button>,
                            ]
                          : []
                      }
                    >
                      <Badge dot={!item.isRead}>
                        <Typography.Text strong={!item.isRead}>{item.title}</Typography.Text>
                      </Badge>
                      {item.createdAt && (
                        <Typography.Text type="secondary" style={{ fontSize: 12, display: "block" }}>
                          {dayjs(item.createdAt).fromNow()}
                        </Typography.Text>
                      )}
                    </List.Item>
                  )}
                />
              }
            >
              <Badge count={notifications.filter(n => !n.isRead).length} size="small">
                <Button shape="circle" icon={<BellOutlined />} />
              </Badge>
            </Popover>
          </div>
        </Header>

        <Content style={{ margin: "16px" }}>
          {loadingDashboard ? (
            <div className="loading-shell">
              <Spin />
            </div>
          ) : (
            <Routes>
              <Route
                path="/dashboard"
                element={<DashboardOverviewPage data={dashboard} />}
              />
              <Route path="/schedule" element={<SchedulePage />} />
              <Route
                path="/meetings"
                element={<MeetingsPage data={dashboard} onCreateMeeting={createScheduledMeeting} onJoinMeeting={joinByLink} />}
              />
              <Route path="/meetings/:id" element={user ? <MeetingDetailPage token={token} user={user} /> : <Navigate to="/login" replace />} />
              <Route path="/invitations/:id" element={user ? <InvitationDetailPage onJoinMeeting={joinByLink} /> : <Navigate to="/login" replace />} />
              <Route path="/room/:id" element={user ? <RoomPlaceholderRoute setActiveCallRoomId={setActiveCallRoomId} setIsCallMinimized={setIsCallMinimized} /> : <Navigate to="/login" replace />} />
              <Route path="*" element={<Navigate to="/dashboard" replace />} />
            </Routes>
          )}
        </Content>
      </Layout>
      {activeCallRoomId && user && token && (
        <div
          style={
            isCallMinimized
              ? {
                  position: "fixed",
                  right: 24,
                  bottom: 24,
                  width: 320,
                  height: 240,
                  zIndex: 9999,
                  background: "rgba(11, 15, 23, 0.95)",
                  borderRadius: 16,
                  overflow: "hidden",
                  boxShadow: "0 12px 40px rgba(0,0,0,0.5)",
                  border: "1px solid rgba(255,255,255,0.12)",
                  transition: "all 0.3s cubic-bezier(.4,0,.2,1)",
                }
              : {
                  position: "fixed",
                  left: 0,
                  top: 0,
                  right: 0,
                  bottom: 0,
                  zIndex: 2000,
                  background: "#0b0f17",
                  transition: "all 0.3s cubic-bezier(.4,0,.2,1)",
                  overflow: "auto",
                }
          }
        >
          <MeetingRoomPage
            token={token}
            user={user}
            roomId={activeCallRoomId}
            isMinimized={isCallMinimized}
            onMinimize={() => {
              setIsCallMinimized(true);
              navigate("/dashboard");
            }}
            onMaximize={() => {
              setIsCallMinimized(false);
              navigate(`/room/${activeCallRoomId}`);
            }}
            onLeave={() => {
              setActiveCallRoomId(null);
              setIsCallMinimized(false);
              navigate("/meetings");
            }}
          />
        </div>
      )}
    </Layout>
  );
}

export default App;
