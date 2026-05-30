import { BellOutlined, CalendarOutlined, ClockCircleOutlined, VideoCameraOutlined } from "@ant-design/icons";
import { Button, Card, Col, List, Row, Space, Statistic, Tag, Typography } from "antd";
import dayjs from "dayjs";
import relativeTime from "dayjs/plugin/relativeTime";
dayjs.extend(relativeTime);
import { useNavigate } from "react-router-dom";
import type { DashboardPayload } from "../api/types";

interface DashboardOverviewPageProps {
  data?: DashboardPayload;
}

export const DashboardOverviewPage = ({ data }: DashboardOverviewPageProps) => {
  const navigate = useNavigate();
  const upcoming = data?.upcomingMeetings ?? [];
  const ongoing = data?.ongoingMeetings ?? [];
  const unreadNotifications = (data?.notifications ?? []).filter((item) => !item.isRead).length;

  const getHostLabel = (ownerId: DashboardPayload["upcomingMeetings"][number]["ownerId"]) => {
    if (ownerId && typeof ownerId === "object") {
      return ownerId.fullName;
    }

    return "Không rõ host";
  };

  return (
    <Space direction="vertical" size={16} style={{ width: "100%" }}>
      <Row gutter={[16, 16]}>
        <Col xs={24} md={6}>
          <Card style={{ borderRadius: 12, border: "1px solid rgba(0,0,0,0.06)", boxShadow: "0 4px 12px rgba(0,0,0,0.02)" }} bodyStyle={{ padding: "16px 24px" }}>
            <Statistic title={<span style={{ fontWeight: 500, fontSize: 14 }}>Đang diễn ra</span>} value={ongoing.length} prefix={<VideoCameraOutlined style={{ color: "#52c41a", marginRight: 8 }} />} valueStyle={{ fontWeight: 600, color: "#1f2937" }} />
          </Card>
        </Col>
        <Col xs={24} md={6}>
          <Card style={{ borderRadius: 12, border: "1px solid rgba(0,0,0,0.06)", boxShadow: "0 4px 12px rgba(0,0,0,0.02)" }} bodyStyle={{ padding: "16px 24px" }}>
            <Statistic title={<span style={{ fontWeight: 500, fontSize: 14 }}>Sắp diễn ra</span>} value={upcoming.length} prefix={<CalendarOutlined style={{ color: "#1677ff", marginRight: 8 }} />} valueStyle={{ fontWeight: 600, color: "#1f2937" }} />
          </Card>
        </Col>
        <Col xs={24} md={6}>
          <Card style={{ borderRadius: 12, border: "1px solid rgba(0,0,0,0.06)", boxShadow: "0 4px 12px rgba(0,0,0,0.02)" }} bodyStyle={{ padding: "16px 24px" }}>
            <Statistic title={<span style={{ fontWeight: 500, fontSize: 14 }}>Lời mời chờ duyệt</span>} value={data?.invitations.length ?? 0} prefix={<ClockCircleOutlined style={{ color: "#faad14", marginRight: 8 }} />} valueStyle={{ fontWeight: 600, color: "#1f2937" }} />
          </Card>
        </Col>
        <Col xs={24} md={6}>
          <Card style={{ borderRadius: 12, border: "1px solid rgba(0,0,0,0.06)", boxShadow: "0 4px 12px rgba(0,0,0,0.02)" }} bodyStyle={{ padding: "16px 24px" }}>
            <Statistic title={<span style={{ fontWeight: 500, fontSize: 14 }}>Thông báo chưa đọc</span>} value={unreadNotifications} prefix={<BellOutlined style={{ color: "#ff4d4f", marginRight: 8 }} />} valueStyle={{ fontWeight: 600, color: "#1f2937" }} />
          </Card>
        </Col>
      </Row>

      <Card
        title={<span style={{ fontSize: 16, fontWeight: 600 }}>Cuộc họp đang diễn ra</span>}
        style={{ borderRadius: 12, border: "1px solid rgba(0,0,0,0.06)", boxShadow: "0 4px 12px rgba(0,0,0,0.02)" }}
        bodyStyle={{ padding: 16 }}
      >
        <List
          dataSource={ongoing.slice(0, 6)}
          locale={{ emptyText: "Không có cuộc họp đang diễn ra" }}
          renderItem={(meeting) => {
            const now = dayjs();
            const start = dayjs(meeting.startTime);
            const canJoin = now.isAfter(start);
            const waitMinutes = Math.max(0, start.diff(now, "minute"));
            return (
              <List.Item
                style={{ padding: "12px 16px", background: "rgba(82, 196, 26, 0.03)", border: "1px solid rgba(82, 196, 26, 0.1)", borderRadius: 8, marginBottom: 8 }}
                actions={[
                  <Button key="detail" type="link" onClick={() => navigate(`/meetings/${meeting._id}`)}>
                    Chi tiết
                  </Button>,
                ]}
              >
                <List.Item.Meta
                  title={<Typography.Text strong style={{ fontSize: 14 }}>{meeting.title}</Typography.Text>}
                  description={
                    <Space direction="vertical" size={2}>
                      <span style={{ fontSize: 12, color: "#4b5563" }}>
                        {`Host: ${getHostLabel(meeting.ownerId)} • ${dayjs(meeting.startTime).format("DD/MM/YYYY HH:mm")} - ${dayjs(meeting.endTime).format("HH:mm")}`}
                      </span>
                      {!canJoin && (
                        <div style={{ color: "#faad14", fontSize: 11, fontWeight: 500 }}>
                          ⚠️ Chờ tới giờ bắt đầu ({waitMinutes} phút nữa)
                        </div>
                      )}
                    </Space>
                  }
                />
                <Button
                  type="primary"
                  size="small"
                  style={{ background: "#52c41a", borderColor: "#52c41a", borderRadius: 4 }}
                  onClick={() => navigate(`/room/${meeting._id}`)}
                >
                  Đang diễn ra
                </Button>
              </List.Item>
            );
          }}
        />
      </Card>

      <Card
        title={<span style={{ fontSize: 16, fontWeight: 600 }}>Lịch họp sắp tới</span>}
        extra={<Button type="link" onClick={() => navigate("/schedule")} style={{ fontSize: 13 }}>Xem calendar</Button>}
        style={{ borderRadius: 12, border: "1px solid rgba(0,0,0,0.06)", boxShadow: "0 4px 12px rgba(0,0,0,0.02)" }}
        bodyStyle={{ padding: 16 }}
      >
        <List
          dataSource={upcoming.slice(0, 6)}
          locale={{ emptyText: "Không có lịch họp sắp tới" }}
          renderItem={(meeting) => (
            <List.Item
              style={{ padding: "12px 16px", border: "1px solid rgba(0,0,0,0.04)", borderRadius: 8, marginBottom: 8, background: "#fafafa" }}
              actions={[
                <Button key="detail" type="link" onClick={() => navigate(`/meetings/${meeting._id}`)}>
                  Chi tiết
                </Button>,
              ]}
            >
              <List.Item.Meta
                title={<Typography.Text strong style={{ fontSize: 14 }}>{meeting.title}</Typography.Text>}
                description={
                  <span style={{ fontSize: 12, color: "#4b5563" }}>
                    {`Host: ${getHostLabel(meeting.ownerId)} • ${dayjs(meeting.startTime).format("DD/MM/YYYY HH:mm")} - ${dayjs(meeting.endTime).format("HH:mm")}`}
                  </span>
                }
              />
              <Tag color="blue" style={{ borderRadius: 4, padding: "2px 8px" }}>Upcoming</Tag>
            </List.Item>
          )}
        />
      </Card>
    </Space>
  );
};
