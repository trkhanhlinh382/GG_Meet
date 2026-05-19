import { BellOutlined, CalendarOutlined, LogoutOutlined, VideoCameraOutlined } from "@ant-design/icons";
import { Avatar, Button, Layout, Menu, Space, Spin, Typography, message } from "antd";
import { useEffect, useMemo, useState } from "react";
import { Navigate, Route, Routes, useLocation, useNavigate } from "react-router-dom";
import { http, setAuthToken } from "./api/http";
import type { DashboardPayload } from "./api/types";
import { DashboardPage } from "./pages/DashboardPage";
import { LoginPage } from "./pages/LoginPage";
import { MeetingRoomPage } from "./pages/MeetingRoomPage";

const { Header, Content, Sider } = Layout;

interface SessionUser {
  id: string;
  fullName: string;
  email: string;
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

function App() {
  const navigate = useNavigate();
  const location = useLocation();

  const [token, setToken] = useState<string | null>(getStoredToken());
  const [user, setUser] = useState<SessionUser | null>(getStoredUser());
  const [dashboard, setDashboard] = useState<DashboardPayload>();
  const [loadingDashboard, setLoadingDashboard] = useState(false);

  useEffect(() => {
    const currentToken = getStoredToken();
    if (currentToken) {
      setAuthToken(currentToken);

      if (!user) {
        const payload = decodeJwtPayload(currentToken);
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
  }, [user]);

  useEffect(() => {
    if (!token) {
      return;
    }

    setLoadingDashboard(true);
    http
      .get<DashboardPayload>("/dashboard", {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      })
      .then((response) => setDashboard(response.data))
      .catch(() => message.warning("Không tải được dashboard, hãy đảm bảo MongoDB và API đang chạy."))
      .finally(() => setLoadingDashboard(false));
  }, [token]);

  const selectedKey = useMemo(() => {
    if (location.pathname.startsWith("/room")) {
      return "room";
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
    setAuthToken(undefined);
    setToken(null);
    setUser(null);
    setDashboard(undefined);
    localStorage.removeItem("gg_meet_user");
    navigate("/login");
  };

  const createInstantMeeting = async () => {
    try {
      const startTime = new Date();
      const endTime = new Date(Date.now() + 60 * 60 * 1000);
      const response = await http.post(
        "/meetings",
        {
          title: `Instant meeting - ${new Date().toLocaleTimeString()}`,
          description: "Instant room",
          category: "team_meeting",
          startTime: startTime.toISOString(),
          endTime: endTime.toISOString(),
          privacyMode: "private",
          waitingRoomEnabled: true,
        },
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        },
      );

      navigate(`/room/${response.data._id}`);
    } catch {
      message.error("Không thể tạo meeting instant");
    }
  };

  const joinUpcomingMeeting = () => {
    const first = dashboard?.upcomingMeetings?.[0];
    if (!first?._id) {
      message.info("Chưa có lịch họp sắp tới, hãy tạo meeting trước");
      return;
    }

    navigate(`/room/${first._id}`);
  };

  if (!token) {
    return <LoginPage onLogin={handleLogin} />;
  }

  return (
    <Layout style={{ minHeight: "100vh" }}>
      <Sider breakpoint="lg" collapsedWidth="0">
        <div className="brand">GG Meet</div>
        <Menu
          theme="dark"
          mode="inline"
          selectedKeys={[selectedKey]}
          onClick={({ key }) => {
            if (key === "dashboard") {
              navigate("/dashboard");
              return;
            }

            joinUpcomingMeeting();
          }}
          items={[
            { key: "dashboard", icon: <CalendarOutlined />, label: "Dashboard" },
            { key: "room", icon: <VideoCameraOutlined />, label: "Meeting Room" },
          ]}
        />
      </Sider>

      <Layout>
        <Header className="app-header">
          <Space>
            <Button shape="circle" icon={<BellOutlined />} />
            <Avatar>{user?.fullName?.charAt(0) ?? "U"}</Avatar>
            <Typography.Text style={{ color: "white" }}>{user?.email ?? "user@ggmeet.dev"}</Typography.Text>
            <Button icon={<LogoutOutlined />} onClick={handleLogout}>
              Logout
            </Button>
          </Space>
        </Header>

        <Content style={{ margin: "16px" }}>
          {loadingDashboard ? (
            <div className="loading-shell">
              <Spin />
            </div>
          ) : (
            <Routes>
              <Route path="/dashboard" element={<DashboardPage data={dashboard} onCreateMeeting={() => void createInstantMeeting()} onJoinMeeting={joinUpcomingMeeting} />} />
              <Route path="/room/:id" element={user ? <MeetingRoomPage token={token} user={user} /> : <Navigate to="/login" replace />} />
              <Route path="*" element={<Navigate to="/dashboard" replace />} />
            </Routes>
          )}
        </Content>
      </Layout>
    </Layout>
  );
}

export default App;
