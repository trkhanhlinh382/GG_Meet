import {
  ArrowLeftOutlined,
  CalendarOutlined,
  ClockCircleOutlined,
  LockOutlined,
  TeamOutlined,
  UnlockOutlined,
  UserOutlined,
} from "@ant-design/icons";
import { Alert, Button, Card, Col, Descriptions, Row, Space, Spin, Tag, Typography, message } from "antd";
import dayjs from "dayjs";
import duration from "dayjs/plugin/duration";
import relativeTime from "dayjs/plugin/relativeTime";
import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { http } from "../api/http";
import type { InvitationWithMeeting } from "../api/types";

dayjs.extend(duration);
dayjs.extend(relativeTime);

interface InvitationDetailPageProps {
  onJoinMeeting: (rawLink: string) => Promise<void>;
}

const CATEGORY_LABELS: Record<string, string> = {
  personal: "Cá nhân",
  interview: "Phỏng vấn",
  team_meeting: "Team Meeting",
  client_meeting: "Khách hàng",
  training: "Đào tạo",
};

const STATUS_COLORS: Record<string, string> = {
  pending: "orange",
  accepted: "green",
  rejected: "red",
  maybe: "blue",
};

const STATUS_LABELS: Record<string, string> = {
  pending: "Chờ phản hồi",
  accepted: "Đã chấp nhận",
  rejected: "Đã từ chối",
  maybe: "Có thể tham gia",
};

export function InvitationDetailPage({ onJoinMeeting }: InvitationDetailPageProps) {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [invitation, setInvitation] = useState<InvitationWithMeeting | null>(null);
  const [loading, setLoading] = useState(true);
  const [acting, setActing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!id) return;
    setLoading(true);
    http
      .get<InvitationWithMeeting>(`/invitations/${id}`)
      .then((res) => setInvitation(res.data))
      .catch(() => setError("Không tìm thấy lời mời hoặc bạn không có quyền truy cập."))
      .finally(() => setLoading(false));
  }, [id]);

  const handleAction = async (action: "accept" | "reject" | "maybe") => {
    if (!id) return;
    setActing(true);
    try {
      const res = await http.post<InvitationWithMeeting>(`/invitations/${id}/${action}`);
      setInvitation(res.data);
      const labels = { accept: "Đã chấp nhận lời mời", reject: "Đã từ chối lời mời", maybe: "Đã trả lời 'Có thể'" };
      void message.success(labels[action]);
    } catch {
      void message.error("Có lỗi xảy ra, vui lòng thử lại.");
    } finally {
      setActing(false);
    }
  };

  const handleJoin = async () => {
    if (!invitation) return;
    const meetingId =
      typeof invitation.meetingId === "string" ? invitation.meetingId : invitation.meetingId._id;
    setActing(true);
    try {
      await onJoinMeeting(meetingId);
    } finally {
      setActing(false);
    }
  };

  if (loading) {
    return (
      <div style={{ display: "flex", justifyContent: "center", paddingTop: 80 }}>
        <Spin size="large" />
      </div>
    );
  }

  if (error || !invitation) {
    return (
      <Space direction="vertical" size={16} style={{ width: "100%" }}>
        <Button icon={<ArrowLeftOutlined />} onClick={() => navigate("/dashboard")}>
          Quay lại
        </Button>
        <Alert message={error ?? "Không tìm thấy lời mời"} type="error" />
      </Space>
    );
  }

  const meeting = typeof invitation.meetingId === "string" ? null : invitation.meetingId;
  if (!meeting) {
    return <Alert message="Dữ liệu cuộc họp không hợp lệ" type="error" />;
  }

  const now = dayjs();
  const startTime = dayjs(meeting.startTime);
  const endTime = dayjs(meeting.endTime);
  const isOngoing = startTime.isBefore(now) && endTime.isAfter(now);
  const isUpcoming = startTime.isAfter(now);
  const isEnded = endTime.isBefore(now);
  const timeUntilStart = isUpcoming ? startTime.diff(now, "minute") : 0;

  const isPending = invitation.status === "pending";
  const isAccepted = invitation.status === "accepted";

  return (
    <Space direction="vertical" size={16} style={{ width: "100%", maxWidth: 800, margin: "0 auto" }}>
      <Space>
        <Button icon={<ArrowLeftOutlined />} onClick={() => navigate("/dashboard")}>
          Quay lại Dashboard
        </Button>
      </Space>

      <Card
        title={
          <Space>
            <CalendarOutlined />
            <Typography.Text strong style={{ fontSize: 18 }}>
              {meeting.title}
            </Typography.Text>
          </Space>
        }
        extra={
          <Space>
            {isOngoing && <Tag color="green">Đang diễn ra</Tag>}
            {isUpcoming && <Tag color="blue">Sắp diễn ra</Tag>}
            {isEnded && <Tag color="default">Đã kết thúc</Tag>}
            <Tag color={STATUS_COLORS[invitation.status] ?? "default"}>
              {STATUS_LABELS[invitation.status] ?? invitation.status}
            </Tag>
          </Space>
        }
      >
        <Descriptions column={{ xs: 1, sm: 2 }} bordered size="small">
          <Descriptions.Item label={<Space><CalendarOutlined /> Bắt đầu</Space>}>
            {startTime.format("HH:mm, DD/MM/YYYY")}
          </Descriptions.Item>
          <Descriptions.Item label={<Space><ClockCircleOutlined /> Kết thúc</Space>}>
            {endTime.format("HH:mm, DD/MM/YYYY")}
          </Descriptions.Item>
          <Descriptions.Item label="Thể loại">
            <Tag>{CATEGORY_LABELS[meeting.category] ?? meeting.category}</Tag>
          </Descriptions.Item>
          <Descriptions.Item label="Chủ cuộc họp">
            {typeof meeting.ownerId === "object" ? `${meeting.ownerId.fullName} (${meeting.ownerId.email})` : "Không rõ host"}
          </Descriptions.Item>
          <Descriptions.Item label={<Space>{meeting.privacyMode === "private" ? <LockOutlined /> : <UnlockOutlined />} Quyền truy cập</Space>}>
            {meeting.privacyMode === "private" ? "Riêng tư" : "Công khai"}
          </Descriptions.Item>
          {meeting.waitingRoomEnabled && (
            <Descriptions.Item label={<Space><TeamOutlined /> Phòng chờ</Space>}>
              <Tag color="orange">Bật</Tag>
            </Descriptions.Item>
          )}
          {meeting.description && (
            <Descriptions.Item label="Mô tả" span={2}>
              {meeting.description}
            </Descriptions.Item>
          )}
        </Descriptions>

        {isUpcoming && timeUntilStart > 0 && (
          <Alert
            style={{ marginTop: 16 }}
            type="info"
            message={
              timeUntilStart < 60
                ? `Cuộc họp bắt đầu sau ${timeUntilStart} phút`
                : `Cuộc họp bắt đầu sau ${Math.floor(timeUntilStart / 60)} giờ ${timeUntilStart % 60} phút`
            }
          />
        )}
      </Card>

      {/* Action buttons */}
      {!isEnded && (
        <Card title="Phản hồi lời mời">
          <Row gutter={[12, 12]}>
            {isPending && (
              <>
                <Col>
                  <Button
                    type="primary"
                    icon={<UserOutlined />}
                    loading={acting}
                    onClick={() => void handleAction("accept")}
                  >
                    Chấp nhận
                  </Button>
                </Col>
                <Col>
                  <Button
                    loading={acting}
                    onClick={() => void handleAction("maybe")}
                  >
                    Có thể tham gia
                  </Button>
                </Col>
                <Col>
                  <Button
                    danger
                    loading={acting}
                    onClick={() => void handleAction("reject")}
                  >
                    Từ chối
                  </Button>
                </Col>
              </>
            )}

            {!isPending && (
              <>
                <Col>
                  <Button loading={acting} onClick={() => void handleAction("accept")} type={isAccepted ? "primary" : "default"}>
                    Chấp nhận
                  </Button>
                </Col>
                <Col>
                  <Button loading={acting} onClick={() => void handleAction("maybe")}>
                    Có thể tham gia
                  </Button>
                </Col>
                <Col>
                  <Button danger loading={acting} onClick={() => void handleAction("reject")}>
                    Từ chối
                  </Button>
                </Col>
              </>
            )}

            {(isAccepted || isOngoing) && (
              <Col>
                <Button
                  type="primary"
                  style={{ background: "#52c41a", borderColor: "#52c41a" }}
                  icon={<TeamOutlined />}
                  loading={acting}
                  onClick={() => void handleJoin()}
                  disabled={isEnded}
                >
                  Tham gia ngay
                </Button>
              </Col>
            )}
          </Row>
        </Card>
      )}
    </Space>
  );
}
