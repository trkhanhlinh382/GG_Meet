import {
  CheckCircleOutlined,
  CrownOutlined,
  DashboardOutlined,
  MailOutlined,
  TeamOutlined,
  VideoCameraOutlined,
} from "@ant-design/icons";
import {
  Avatar,
  Card,
  Col,
  List,
  Progress,
  Row,
  Spin,
  Statistic,
  Tabs,
  Tag,
  Typography,
  message,
} from "antd";
import { useEffect, useState } from "react";
import { http } from "../../api/http";
import { UserManagementPage } from "./UserManagementPage";

interface AdminStats {
  totalUsers: number;
  totalMeetings: number;
  totalInvitations: number;
  activeMeetings: number;
  roles: Record<string, number>;
  recentUsers: Array<{
    _id: string;
    fullName: string;
    email: string;
    role: string;
    avatar?: string;
    createdAt?: string;
  }>;
}

export const AdminLayout = () => {
  const [stats, setStats] = useState<AdminStats | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [activeTab, setActiveTab] = useState<string>("overview");

  const fetchStats = async () => {
    try {
      setLoading(true);
      const res = await http.get<AdminStats>("/admin/stats");
      setStats(res.data);
    } catch {
      void message.error("Không thể tải thống kê hệ thống. Hãy kiểm tra phân quyền tài khoản.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (activeTab === "overview") {
      void fetchStats();
    }
  }, [activeTab]);

  const getRoleTagColor = (role: string) => {
    switch (role) {
      case "super_admin":
        return "purple";
      case "admin":
        return "red";
      case "manager":
        return "gold";
      case "host":
        return "blue";
      default:
        return "default";
    }
  };

  const getRoleLabel = (role: string) => {
    switch (role) {
      case "super_admin":
        return "Super Admin";
      case "admin":
        return "Administrator";
      case "manager":
        return "Manager";
      case "host":
        return "Host";
      case "personal":
        return "Personal";
      default:
        return role;
    }
  };

  const renderOverview = () => {
    if (loading && !stats) {
      return (
        <div style={{ display: "flex", justifyContent: "center", padding: "64px 0" }}>
          <Spin size="large" tip="Đang tải dữ liệu hệ thống..." />
        </div>
      );
    }

    if (!stats) return null;

    const roleEntries = Object.entries(stats.roles);

    return (
      <div className="anim-slide-up">
        {/* Stats Row */}
        <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
          <Col xs={24} sm={12} lg={6}>
            <Card bordered={false} className="stats-card" style={{ background: "linear-gradient(135deg, rgba(99, 102, 241, 0.15) 0%, var(--bg-surface) 100%)", border: "1px solid rgba(99, 102, 241, 0.2)" }}>
              <Statistic
                title={<span style={{ color: "var(--text-secondary)" }}>Tổng người dùng</span>}
                value={stats.totalUsers}
                prefix={<TeamOutlined style={{ color: "var(--accent)" }} />}
                valueStyle={{ color: "#fff", fontWeight: 700 }}
              />
            </Card>
          </Col>
          <Col xs={24} sm={12} lg={6}>
            <Card bordered={false} className="stats-card" style={{ background: "linear-gradient(135deg, rgba(16, 185, 129, 0.15) 0%, var(--bg-surface) 100%)", border: "1px solid rgba(16, 185, 129, 0.2)" }}>
              <Statistic
                title={<span style={{ color: "var(--text-secondary)" }}>Cuộc họp hiện tại</span>}
                value={stats.activeMeetings}
                prefix={<CheckCircleOutlined style={{ color: "#10b981" }} />}
                valueStyle={{ color: "#fff", fontWeight: 700 }}
              />
            </Card>
          </Col>
          <Col xs={24} sm={12} lg={6}>
            <Card bordered={false} className="stats-card" style={{ background: "linear-gradient(135deg, rgba(139, 92, 246, 0.15) 0%, var(--bg-surface) 100%)", border: "1px solid rgba(139, 92, 246, 0.2)" }}>
              <Statistic
                title={<span style={{ color: "var(--text-secondary)" }}>Tổng số cuộc họp</span>}
                value={stats.totalMeetings}
                prefix={<VideoCameraOutlined style={{ color: "#8b5cf6" }} />}
                valueStyle={{ color: "#fff", fontWeight: 700 }}
              />
            </Card>
          </Col>
          <Col xs={24} sm={12} lg={6}>
            <Card bordered={false} className="stats-card" style={{ background: "linear-gradient(135deg, rgba(245, 158, 11, 0.15) 0%, var(--bg-surface) 100%)", border: "1px solid rgba(245, 158, 11, 0.2)" }}>
              <Statistic
                title={<span style={{ color: "var(--text-secondary)" }}>Lời mời gửi đi</span>}
                value={stats.totalInvitations}
                prefix={<MailOutlined style={{ color: "#f59e0b" }} />}
                valueStyle={{ color: "#fff", fontWeight: 700 }}
              />
            </Card>
          </Col>
        </Row>

        {/* Details Row */}
        <Row gutter={[16, 16]}>
          {/* Role Distribution */}
          <Col xs={24} md={10}>
            <Card
              title={<span style={{ color: "#fff", fontSize: 16, fontWeight: 600 }}>Cơ cấu người dùng</span>}
              bordered={false}
              style={{ background: "var(--bg-surface)", border: "1px solid var(--border)", height: "100%" }}
            >
              {roleEntries.length === 0 ? (
                <div style={{ textAlign: "center", color: "var(--text-muted)", padding: "20px 0" }}>Chưa có thông tin phân vai</div>
              ) : (
                roleEntries.map(([role, count]) => {
                  const percent = Math.round((count / stats.totalUsers) * 100);
                  return (
                    <div key={role} style={{ marginBottom: 18 }}>
                      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
                        <Tag color={getRoleTagColor(role)} style={{ fontWeight: 500 }}>{getRoleLabel(role)}</Tag>
                        <span style={{ color: "#fff", fontWeight: 600 }}>
                          {count} ({percent}%)
                        </span>
                      </div>
                      <Progress
                        percent={percent}
                        showInfo={false}
                        strokeColor={
                          role === "super_admin" || role === "admin"
                            ? "var(--accent)"
                            : role === "host"
                            ? "#8b5cf6"
                            : "#10b981"
                        }
                        trailColor="rgba(255,255,255,0.05)"
                      />
                    </div>
                  );
                })
              )}
            </Card>
          </Col>

          {/* Recent Signups */}
          <Col xs={24} md={14}>
            <Card
              title={<span style={{ color: "#fff", fontSize: 16, fontWeight: 600 }}>Đăng ký gần đây</span>}
              bordered={false}
              style={{ background: "var(--bg-surface)", border: "1px solid var(--border)", height: "100%" }}
            >
              <List
                itemLayout="horizontal"
                dataSource={stats.recentUsers}
                locale={{ emptyText: "Chưa có thành viên đăng ký" }}
                renderItem={(item) => (
                  <List.Item style={{ padding: "12px 0", borderBottom: "1px solid var(--border)" }}>
                    <List.Item.Meta
                      avatar={
                        <Avatar src={item.avatar} style={{ border: "2px solid var(--border-strong)" }}>
                          {item.fullName.charAt(0).toUpperCase()}
                        </Avatar>
                      }
                      title={
                        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                          <span style={{ color: "#fff", fontWeight: 600 }}>{item.fullName}</span>
                          <Tag color={getRoleTagColor(item.role)}>
                            {getRoleLabel(item.role)}
                          </Tag>
                        </div>
                      }
                      description={
                        <span style={{ color: "var(--text-muted)", fontSize: 12 }}>
                          {item.email}
                        </span>
                      }
                    />
                    <div style={{ color: "var(--text-muted)", fontSize: 12 }}>
                      {item.createdAt ? new Date(item.createdAt).toLocaleDateString("vi-VN") : ""}
                    </div>
                  </List.Item>
                )}
              />
            </Card>
          </Col>
        </Row>
      </div>
    );
  };

  const tabItems = [
    {
      key: "overview",
      label: (
        <span>
          <DashboardOutlined /> Tổng quan
        </span>
      ),
      children: renderOverview(),
    },
    {
      key: "users",
      label: (
        <span>
          <TeamOutlined /> Quản lý User
        </span>
      ),
      children: <UserManagementPage />,
    },
  ];

  return (
    <div style={{ maxWidth: 1200, margin: "0 auto" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 20 }}>
        <div
          style={{
            width: 42,
            height: 42,
            borderRadius: 12,
            background: "linear-gradient(135deg, var(--accent), #8b5cf6)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            color: "#fff",
            fontSize: 20,
          }}
        >
          <CrownOutlined />
        </div>
        <div>
          <Typography.Title level={2} style={{ color: "#fff", margin: 0, fontSize: 24, fontWeight: 700 }}>
            Quản Trị Hệ Thống
          </Typography.Title>
          <Typography.Text style={{ color: "var(--text-secondary)", fontSize: 13 }}>
            Giám sát cuộc họp, quản lý tài khoản và cấu hình hệ thống GG Meet.
          </Typography.Text>
        </div>
      </div>

      <Card
        bordered={false}
        style={{
          background: "var(--bg-surface)",
          border: "1px solid var(--border)",
          borderRadius: "var(--r-xl)",
        }}
        bodyStyle={{ padding: "24px" }}
      >
        <Tabs
          activeKey={activeTab}
          onChange={setActiveTab}
          items={tabItems}
          size="large"
          style={{ color: "var(--text-secondary)" }}
        />
      </Card>
    </div>
  );
};
