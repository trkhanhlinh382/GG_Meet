import {
  ArrowLeftOutlined,
  CalendarOutlined,
  CheckCircleOutlined,
  ClockCircleOutlined,
  LockOutlined,
  QuestionCircleOutlined,
  TeamOutlined,
  UnlockOutlined,
  UserOutlined,
  VideoCameraOutlined,
} from "@ant-design/icons";
import {
  Alert,
  Avatar,
  Button,
  Card,
  Space,
  Spin,
  Tag,
  Typography,
  message,
} from "antd";
import dayjs from "dayjs";
import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { http } from "../api/http";
import type { InvitationWithMeeting } from "../api/types";

interface InvitationDetailPageProps {
  onJoinMeeting: (rawLink: string) => Promise<void>;
}

const CATEGORY_LABELS: Record<string, string> = {
  personal: "Cá nhân",
  interview: "Phỏng vấn",
  team_meeting: "Họp nhóm",
  client_meeting: "Khách hàng",
  training: "Đào tạo",
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
      .get<{ invitation: InvitationWithMeeting } | InvitationWithMeeting>(`/invitations/${id}`)
      .then((res) => {
        const data = res.data;
        // Handle both { invitation: ... } and flat shapes
        if ("invitation" in data && data.invitation) {
          setInvitation(data.invitation);
        } else {
          setInvitation(data as InvitationWithMeeting);
        }
      })
      .catch(() => setError("Không tìm thấy lời mời hoặc bạn không có quyền truy cập."))
      .finally(() => setLoading(false));
  }, [id]);

  const handleAction = async (status: "accepted" | "rejected" | "maybe") => {
    if (!id) return;
    setActing(true);
    try {
      const res = await http.patch<InvitationWithMeeting>(`/invitations/${id}`, { status });
      setInvitation(res.data);
      const labels: Record<string, string> = {
        accepted: "Đã chấp nhận lời mời",
        rejected: "Đã từ chối lời mời",
        maybe: "Đã trả lời 'Có thể'",
      };
      void message.success(labels[status]);
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
      <div
        style={{
          display: "flex",
          justifyContent: "center",
          alignItems: "center",
          paddingTop: 100,
          flexDirection: "column",
          gap: 16,
        }}
      >
        <Spin size="large" />
        <span style={{ color: "var(--text-secondary)", fontSize: 14 }}>Đang tải lời mời...</span>
      </div>
    );
  }

  if (error || !invitation) {
    return (
      <div style={{ maxWidth: 600, margin: "0 auto", padding: "40px 0" }}>
        <Button
          icon={<ArrowLeftOutlined />}
          onClick={() => navigate(-1)}
          style={{
            background: "var(--bg-surface-2)",
            border: "1px solid var(--border-strong)",
            color: "var(--text-primary)",
            marginBottom: 16,
          }}
        >
          Quay lại
        </Button>
        <Alert message={error ?? "Không tìm thấy lời mời"} type="error" showIcon />
      </div>
    );
  }

  const meeting = typeof invitation.meetingId === "string" ? null : invitation.meetingId;
  if (!meeting) {
    return (
      <div style={{ maxWidth: 600, margin: "0 auto", padding: "40px 0" }}>
        <Alert message="Dữ liệu cuộc họp không hợp lệ" type="error" showIcon />
      </div>
    );
  }

  const now = dayjs();
  const startTime = dayjs(meeting.startTime);
  const endTime = dayjs(meeting.endTime);
  const isOngoing = startTime.isBefore(now) && endTime.isAfter(now);
  const isUpcoming = startTime.isAfter(now);
  const isEnded = endTime.isBefore(now);
  const timeUntilStart = isUpcoming ? startTime.diff(now, "minute") : 0;

  const isAccepted = invitation.status === "accepted";
  const isMaybe = invitation.status === "maybe";
  const isRejected = invitation.status === "rejected";

  const hostName =
    typeof meeting.ownerId === "object"
      ? meeting.ownerId.fullName
      : "Không rõ host";
  const hostInitial = hostName.charAt(0).toUpperCase();

  return (
    <div style={{ maxWidth: 600, margin: "0 auto", padding: "8px 0 40px", display: "flex", flexDirection: "column", gap: 20 }}>
      {/* Back button */}
      <Button
        icon={<ArrowLeftOutlined />}
        onClick={() => navigate(-1)}
        style={{
          alignSelf: "flex-start",
          background: "var(--bg-surface-2)",
          border: "1px solid var(--border-strong)",
          color: "var(--text-primary)",
          borderRadius: "var(--r-sm)",
        }}
      >
        Quay lại
      </Button>

      {/* Main card */}
      <Card
        styles={{ body: { padding: 28 } }}
        style={{
          background: "var(--bg-surface)",
          border: "1px solid var(--border)",
          borderRadius: "var(--r-lg)",
        }}
      >
        {/* Status badges row */}
        <Space style={{ marginBottom: 16 }} wrap>
          {isOngoing && <span className="badge-live">Đang diễn ra</span>}
          {isUpcoming && <span className="badge-upcoming">Sắp tới</span>}
          {isEnded && <span className="badge-ended">Đã kết thúc</span>}
          <Tag
            style={{
              background:
                invitation.status === "accepted"
                  ? "rgba(34,197,94,0.12)"
                  : invitation.status === "rejected"
                  ? "rgba(239,68,68,0.12)"
                  : invitation.status === "maybe"
                  ? "rgba(245,158,11,0.12)"
                  : "rgba(71,85,105,0.15)",
              color:
                invitation.status === "accepted"
                  ? "var(--accent-success)"
                  : invitation.status === "rejected"
                  ? "var(--accent-danger)"
                  : invitation.status === "maybe"
                  ? "var(--accent-warn)"
                  : "var(--text-muted)",
              border: "none",
              borderRadius: "var(--r-xs)",
              fontWeight: 600,
              fontSize: 11,
            }}
          >
            {STATUS_LABELS[invitation.status] ?? invitation.status}
          </Tag>
        </Space>

        {/* Meeting title */}
        <Typography.Title
          level={2}
          style={{
            color: "var(--text-primary)",
            fontWeight: 700,
            fontSize: 22,
            marginBottom: 20,
            lineHeight: 1.3,
          }}
        >
          {meeting.title}
        </Typography.Title>

        {/* Host info */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 12,
            background: "var(--bg-surface-2)",
            borderRadius: "var(--r-md)",
            padding: "12px 16px",
            marginBottom: 20,
          }}
        >
          <Avatar
            style={{
              background: "linear-gradient(135deg, var(--accent), #8b5cf6)",
              color: "#fff",
              fontWeight: 700,
              fontSize: 15,
              flexShrink: 0,
            }}
            size={40}
          >
            {hostInitial}
          </Avatar>
          <div>
            <div style={{ fontSize: 13, color: "var(--text-secondary)", marginBottom: 2 }}>
              Chủ cuộc họp
            </div>
            <div style={{ fontSize: 14, fontWeight: 600, color: "var(--text-primary)" }}>
              {hostName}
              {typeof meeting.ownerId === "object" && (
                <span style={{ color: "var(--text-muted)", fontWeight: 400, fontSize: 12, marginLeft: 6 }}>
                  ({meeting.ownerId.email})
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Details grid */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "1fr 1fr",
            gap: 12,
            marginBottom: 20,
          }}
        >
          <div
            style={{
              background: "var(--bg-surface-2)",
              borderRadius: "var(--r-sm)",
              padding: "12px 14px",
              border: "1px solid var(--border)",
            }}
          >
            <div style={{ fontSize: 11, color: "var(--text-muted)", marginBottom: 4, display: "flex", alignItems: "center", gap: 4 }}>
              <CalendarOutlined /> Bắt đầu
            </div>
            <div style={{ fontSize: 13, fontWeight: 600, color: "var(--text-primary)" }}>
              {startTime.format("HH:mm, DD/MM/YYYY")}
            </div>
          </div>

          <div
            style={{
              background: "var(--bg-surface-2)",
              borderRadius: "var(--r-sm)",
              padding: "12px 14px",
              border: "1px solid var(--border)",
            }}
          >
            <div style={{ fontSize: 11, color: "var(--text-muted)", marginBottom: 4, display: "flex", alignItems: "center", gap: 4 }}>
              <ClockCircleOutlined /> Kết thúc
            </div>
            <div style={{ fontSize: 13, fontWeight: 600, color: "var(--text-primary)" }}>
              {endTime.year() > 2090 ? "Vô hạn (Không giới hạn)" : endTime.format("HH:mm, DD/MM/YYYY")}
            </div>
          </div>

          <div
            style={{
              background: "var(--bg-surface-2)",
              borderRadius: "var(--r-sm)",
              padding: "12px 14px",
              border: "1px solid var(--border)",
            }}
          >
            <div style={{ fontSize: 11, color: "var(--text-muted)", marginBottom: 4, display: "flex", alignItems: "center", gap: 4 }}>
              <TeamOutlined /> Loại cuộc họp
            </div>
            <div style={{ fontSize: 13, fontWeight: 600, color: "var(--text-primary)" }}>
              {CATEGORY_LABELS[meeting.category] ?? meeting.category}
            </div>
          </div>

          <div
            style={{
              background: "var(--bg-surface-2)",
              borderRadius: "var(--r-sm)",
              padding: "12px 14px",
              border: "1px solid var(--border)",
            }}
          >
            <div style={{ fontSize: 11, color: "var(--text-muted)", marginBottom: 4, display: "flex", alignItems: "center", gap: 4 }}>
              {meeting.privacyMode === "private" ? <LockOutlined /> : <UnlockOutlined />} Quyền truy cập
            </div>
            <div style={{ fontSize: 13, fontWeight: 600, color: "var(--text-primary)" }}>
              {meeting.privacyMode === "private" ? "Riêng tư" : "Công khai"}
            </div>
          </div>
        </div>

        {/* Description */}
        {meeting.description && (
          <div
            style={{
              background: "var(--bg-surface-2)",
              borderRadius: "var(--r-sm)",
              padding: "12px 14px",
              border: "1px solid var(--border)",
              marginBottom: 20,
            }}
          >
            <div style={{ fontSize: 11, color: "var(--text-muted)", marginBottom: 6 }}>
              Mô tả
            </div>
            <div style={{ fontSize: 13, color: "var(--text-primary)", lineHeight: 1.6 }}>
              {meeting.description}
            </div>
          </div>
        )}

        {/* Countdown alert */}
        {isUpcoming && timeUntilStart > 0 && (
          <Alert
            type="info"
            showIcon
            style={{ marginBottom: 20, borderRadius: "var(--r-sm)" }}
            message={
              timeUntilStart < 60
                ? `Cuộc họp bắt đầu sau ${timeUntilStart} phút`
                : `Cuộc họp bắt đầu sau ${Math.floor(timeUntilStart / 60)} giờ ${timeUntilStart % 60} phút`
            }
          />
        )}

        {/* Action buttons */}
        {!isEnded && (
          <div>
            <div style={{ fontSize: 13, fontWeight: 600, color: "var(--text-secondary)", marginBottom: 12 }}>
              Phản hồi lời mời
            </div>
            <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
              <Button
                size="large"
                loading={acting}
                icon={<CheckCircleOutlined />}
                onClick={() => void handleAction("accepted")}
                style={{
                  flex: 1,
                  minWidth: 120,
                  background: isAccepted ? "var(--accent-success)" : "var(--bg-surface-2)",
                  border: isAccepted
                    ? "1px solid var(--accent-success)"
                    : "1px solid var(--border-strong)",
                  color: isAccepted ? "#fff" : "var(--text-primary)",
                  borderRadius: "var(--r-sm)",
                  fontWeight: 600,
                }}
              >
                Chấp nhận
              </Button>
              <Button
                size="large"
                loading={acting}
                icon={<QuestionCircleOutlined />}
                onClick={() => void handleAction("maybe")}
                style={{
                  flex: 1,
                  minWidth: 120,
                  background: isMaybe ? "rgba(245,158,11,0.15)" : "var(--bg-surface-2)",
                  border: isMaybe
                    ? "1px solid var(--accent-warn)"
                    : "1px solid var(--border-strong)",
                  color: isMaybe ? "var(--accent-warn)" : "var(--text-primary)",
                  borderRadius: "var(--r-sm)",
                  fontWeight: 600,
                }}
              >
                Có thể
              </Button>
              <Button
                size="large"
                loading={acting}
                icon={<UserOutlined />}
                onClick={() => void handleAction("rejected")}
                style={{
                  flex: 1,
                  minWidth: 120,
                  background: isRejected ? "rgba(239,68,68,0.12)" : "var(--bg-surface-2)",
                  border: isRejected
                    ? "1px solid var(--accent-danger)"
                    : "1px solid var(--border-strong)",
                  color: isRejected ? "var(--accent-danger)" : "var(--text-primary)",
                  borderRadius: "var(--r-sm)",
                  fontWeight: 600,
                }}
              >
                Từ chối
              </Button>
            </div>
          </div>
        )}

        {/* Join now button */}
        {isOngoing && isAccepted && (
          <Button
            type="primary"
            size="large"
            block
            icon={<VideoCameraOutlined />}
            loading={acting}
            onClick={() => void handleJoin()}
            style={{
              marginTop: 16,
              background: "var(--accent-success)",
              borderColor: "var(--accent-success)",
              borderRadius: "var(--r-sm)",
              fontWeight: 700,
              fontSize: 15,
              height: 48,
            }}
          >
            Tham gia ngay
          </Button>
        )}
      </Card>
    </div>
  );
}
