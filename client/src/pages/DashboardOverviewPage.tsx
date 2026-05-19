import { BellOutlined, CalendarOutlined, ClockCircleOutlined, VideoCameraOutlined } from "@ant-design/icons";
import { Badge, Button, Card, Col, List, Row, Space, Statistic, Tag, Typography } from "antd";
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
          <Card>
            <Statistic title="Đang diễn ra" value={ongoing.length} prefix={<VideoCameraOutlined />} />
          </Card>
        </Col>
        <Col xs={24} md={6}>
          <Card>
            <Statistic title="Sắp diễn ra" value={upcoming.length} prefix={<CalendarOutlined />} />
          </Card>
        </Col>
        <Col xs={24} md={6}>
          <Card>
            <Statistic title="Lời mời chờ phản hồi" value={data?.invitations.length ?? 0} prefix={<ClockCircleOutlined />} />
          </Card>
        </Col>
        <Col xs={24} md={6}>
          <Card>
            <Statistic title="Thông báo chưa đọc" value={unreadNotifications} prefix={<BellOutlined />} />
          </Card>
        </Col>
      </Row>


      <Card
        title="Cuộc họp đang diễn ra"
        extra={null}
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
                actions={[
                  <Button
                    key="join"
                    type="primary"
                    disabled={!canJoin}
                    style={!canJoin ? { opacity: 0.5, pointerEvents: "none" } : {}}
                    onClick={() => navigate(`/room/${meeting._id}`)}
                  >
                    Tham gia
                  </Button>,
                  <Button key="detail" type="link" onClick={() => navigate(`/meetings/${meeting._id}`)}>
                    Chi tiết
                  </Button>,
                ]}
              >
                <List.Item.Meta
                  title={meeting.title}
                  description={
                    <>
                      {`Host: ${getHostLabel(meeting.ownerId)} • ${dayjs(meeting.startTime).format("DD/MM/YYYY HH:mm")} - ${dayjs(meeting.endTime).format("HH:mm")}`}
                      {!canJoin && (
                        <div style={{ color: "#faad14", fontSize: 12 }}>
                          Chờ tới giờ bắt đầu ({waitMinutes} phút nữa)
                        </div>
                      )}
                    </>
                  }
                />
                <Tag color="green">Ongoing</Tag>
              </List.Item>
            );
          }}
        />
      </Card>

      <Card
        title="Lịch họp sắp tới"
        extra={<Button type="link" onClick={() => navigate("/schedule")}>Xem calendar</Button>}
      >
        <List
          dataSource={upcoming.slice(0, 6)}
          locale={{ emptyText: "Không có lịch họp sắp tới" }}
          renderItem={(meeting) => (
            <List.Item
              actions={[
                <Button key="detail" type="link" onClick={() => navigate(`/meetings/${meeting._id}`)}>
                  Chi tiết
                </Button>,
              ]}
            >
              <List.Item.Meta
                title={meeting.title}
                description={`Host: ${getHostLabel(meeting.ownerId)} • ${dayjs(meeting.startTime).format("DD/MM/YYYY HH:mm")} - ${dayjs(meeting.endTime).format("HH:mm")}`}
              />
              <Tag color="blue">Upcoming</Tag>
            </List.Item>
          )}
        />
      </Card>

    </Space>
  );
};
