import {
  CalendarOutlined,
  ClockCircleOutlined,
  MailOutlined,
  PlusOutlined,
  ThunderboltOutlined,
  UserOutlined,
  VideoCameraOutlined,
} from "@ant-design/icons";
import {
  Badge,
  Button,
  DatePicker,
  Form,
  Input,
  Modal,
  Select,
  Switch,
  Tabs,
  Tag,
  Typography,
  message,
} from "antd";
import type { Dayjs } from "dayjs";
import dayjs from "dayjs";
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import type { DashboardPayload, InvitationWithMeeting, Meeting } from "../api/types";

interface CreateMeetingInput {
  title: string;
  description?: string;
  category: "personal" | "interview" | "team_meeting" | "client_meeting" | "training";
  startTime: string;
  endTime: string;
  privacyMode: "public" | "private";
  waitingRoomEnabled: boolean;
  isInstant?: boolean;
  isRecurring?: boolean;
  recurrence?: { frequency: "daily" | "weekly" | "monthly"; endDate: string };
}

interface MeetingsPageProps {
  data?: DashboardPayload;
  onCreateMeeting: (input: CreateMeetingInput) => Promise<void>;
  onJoinMeeting: (rawLink: string) => Promise<void>;
}

const CATEGORY_LABELS: Record<string, string> = {
  personal: "Cá nhân",
  interview: "Phỏng vấn",
  team_meeting: "Họp nhóm",
  client_meeting: "Khách hàng",
  training: "Đào tạo",
};

const getHostLabel = (ownerId: Meeting["ownerId"]) => {
  if (ownerId && typeof ownerId === "object") {
    return ownerId.fullName;
  }
  return "Không rõ host";
};

export const MeetingsPage = ({ data, onCreateMeeting, onJoinMeeting }: MeetingsPageProps) => {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState("all");
  const [instantOpen, setInstantOpen] = useState(false);
  const [instantTitle, setInstantTitle] = useState("Cuộc họp tức thì");
  const [instantLoading, setInstantLoading] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const [showRecurrence, setShowRecurrence] = useState(false);
  const [joinLink, setJoinLink] = useState("");
  const [joining, setJoining] = useState(false);
  const [createForm] = Form.useForm();

  const ongoing = data?.ongoingMeetings ?? [];
  const upcoming = data?.upcomingMeetings ?? [];
  const history = data?.meetingHistory ?? [];
  const invitations = (data?.invitations ?? []) as InvitationWithMeeting[];

  const allMeetings = [
    ...ongoing.map((m) => ({ ...m, _status: "live" as const })),
    ...upcoming.map((m) => ({ ...m, _status: "upcoming" as const })),
    ...history.map((m) => ({ ...m, _status: "ended" as const })),
  ];

  const filteredMeetings = activeTab === "all"
    ? allMeetings
    : activeTab === "live"
    ? allMeetings.filter((m) => m._status === "live")
    : activeTab === "upcoming"
    ? allMeetings.filter((m) => m._status === "upcoming")
    : allMeetings.filter((m) => m._status === "ended");

  const handleInstantMeeting = async () => {
    setInstantLoading(true);
    try {
      await onCreateMeeting({
        title: instantTitle || "Cuộc họp tức thì",
        category: "team_meeting",
        startTime: new Date().toISOString(),
        endTime: "2099-12-31T23:59:59Z",
        privacyMode: "public",
        waitingRoomEnabled: false,
        isInstant: true,
      });
      setInstantOpen(false);
      setInstantTitle("Cuộc họp tức thì");
    } catch {
      void message.error("Không thể tạo cuộc họp tức thì");
    } finally {
      setInstantLoading(false);
    }
  };

  const handleCreateMeeting = async () => {
    try {
      const values = await createForm.validateFields();
      const [start, end] = values.timeRange as [Dayjs, Dayjs];

      if (start.isBefore(dayjs())) {
        void message.warning("Thời gian bắt đầu phải ở tương lai");
        return;
      }
      if (!end.isAfter(start)) {
        void message.warning("Thời gian kết thúc phải sau thời gian bắt đầu");
        return;
      }

      setCreating(true);
      await onCreateMeeting({
        title: values.title as string,
        description: values.description as string | undefined,
        category: values.category as CreateMeetingInput["category"],
        startTime: start.toISOString(),
        endTime: end.toISOString(),
        privacyMode: values.privacyMode as "public" | "private",
        waitingRoomEnabled: Boolean(values.waitingRoomEnabled),
        isRecurring: Boolean(values.isRecurring),
        recurrence:
          values.isRecurring && values.recurrence
            ? {
                frequency: values.recurrence.frequency as "daily" | "weekly" | "monthly",
                endDate: (values.recurrence.endDate as Dayjs).toISOString(),
              }
            : undefined,
      });
      setCreateOpen(false);
      createForm.resetFields();
      setShowRecurrence(false);
    } finally {
      setCreating(false);
    }
  };

  const handleJoinByLink = async () => {
    if (!joinLink.trim()) {
      void message.warning("Vui lòng nhập link hoặc ID cuộc họp");
      return;
    }
    setJoining(true);
    try {
      await onJoinMeeting(joinLink.trim());
      setJoinLink("");
    } finally {
      setJoining(false);
    }
  };

  const renderMeetingCard = (meeting: (typeof allMeetings)[number]) => {
    const isLive = meeting._status === "live";
    const isUpcoming = meeting._status === "upcoming";

    return (
      <div
        key={meeting._id}
        className={`meeting-card${isLive ? " live" : ""}`}
        onClick={() => navigate(`/meetings/${meeting._id}`)}
      >
        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 10 }}>
          <div>
            {isLive && <span className="badge-live">Live</span>}
            {isUpcoming && <span className="badge-upcoming">Sắp tới</span>}
            {meeting._status === "ended" && <span className="badge-ended">Đã kết thúc</span>}
          </div>
          <Tag
            style={{
              background: "var(--bg-surface-2)",
              color: "var(--text-secondary)",
              border: "1px solid var(--border)",
              borderRadius: "var(--r-xs)",
              fontSize: 11,
              margin: 0,
            }}
          >
            {CATEGORY_LABELS[meeting.category] ?? meeting.category}
          </Tag>
        </div>

        <div className="meeting-card-title">{meeting.title}</div>

        <div className="meeting-card-meta" style={{ marginBottom: 12 }}>
          <UserOutlined style={{ fontSize: 11 }} />
          <span>{getHostLabel(meeting.ownerId)}</span>
          <span style={{ color: "var(--border-strong)" }}>•</span>
          <CalendarOutlined style={{ fontSize: 11 }} />
          <span>{dayjs(meeting.startTime).format("DD/MM/YYYY")}</span>
          <span style={{ color: "var(--border-strong)" }}>•</span>
          <ClockCircleOutlined style={{ fontSize: 11 }} />
          <span>
            {dayjs(meeting.startTime).format("HH:mm")} – {dayjs(meeting.endTime).format("HH:mm")}
          </span>
        </div>

        <div
          style={{ display: "flex", gap: 8 }}
          onClick={(e) => e.stopPropagation()}
        >
          {isLive && (
            <Button
              type="primary"
              size="small"
              icon={<VideoCameraOutlined />}
              style={{
                background: "var(--accent-success)",
                borderColor: "var(--accent-success)",
                borderRadius: "var(--r-xs)",
                fontSize: 12,
              }}
              onClick={() => void onJoinMeeting(meeting._id)}
            >
              Vào họp
            </Button>
          )}
          <Button
            size="small"
            style={{
              background: "var(--bg-surface-2)",
              borderColor: "var(--border-strong)",
              color: "var(--text-secondary)",
              borderRadius: "var(--r-xs)",
              fontSize: 12,
            }}
            onClick={() => navigate(`/meetings/${meeting._id}`)}
          >
            Chi tiết
          </Button>
        </div>
      </div>
    );
  };

  const tabItems = [
    { key: "all", label: `Tất cả (${allMeetings.length})` },
    { key: "live", label: `Đang diễn ra (${ongoing.length})` },
    { key: "upcoming", label: `Sắp tới (${upcoming.length})` },
    { key: "ended", label: `Đã kết thúc (${history.length})` },
  ];

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
      {/* Page Header */}
      <div className="page-header" style={{ marginBottom: 0 }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 12 }}>
          <div>
            <div className="page-title">Cuộc họp</div>
            <div className="page-subtitle">Quản lý và tham gia các cuộc họp của bạn</div>
          </div>
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
            <Button
              icon={<ThunderboltOutlined />}
              onClick={() => setInstantOpen(true)}
              style={{
                background: "var(--bg-surface-2)",
                border: "1px solid var(--border-strong)",
                color: "var(--text-primary)",
                borderRadius: "var(--r-sm)",
                fontWeight: 600,
              }}
            >
              Họp ngay
            </Button>
            <Button
              type="primary"
              icon={<PlusOutlined />}
              onClick={() => setCreateOpen(true)}
              style={{
                background: "var(--accent)",
                borderColor: "var(--accent)",
                borderRadius: "var(--r-sm)",
                fontWeight: 600,
              }}
            >
              Tạo phòng họp
            </Button>
          </div>
        </div>
      </div>

      {/* Join by link row */}
      <div
        style={{
          display: "flex",
          gap: 10,
          background: "var(--bg-surface)",
          border: "1px solid var(--border)",
          borderRadius: "var(--r-md)",
          padding: "14px 20px",
          alignItems: "center",
        }}
      >
        <VideoCameraOutlined style={{ color: "var(--text-secondary)", fontSize: 16, flexShrink: 0 }} />
        <Input
          placeholder="Nhập link hoặc ID cuộc họp để tham gia..."
          value={joinLink}
          onChange={(e) => setJoinLink(e.target.value)}
          onPressEnter={() => void handleJoinByLink()}
          style={{ flex: 1 }}
        />
        <Button
          type="primary"
          loading={joining}
          onClick={() => void handleJoinByLink()}
          style={{
            background: "var(--accent)",
            borderColor: "var(--accent)",
            borderRadius: "var(--r-sm)",
            flexShrink: 0,
          }}
        >
          Tham gia
        </Button>
      </div>

      {/* Meetings section */}
      <div
        style={{
          background: "var(--bg-surface)",
          border: "1px solid var(--border)",
          borderRadius: "var(--r-lg)",
          overflow: "hidden",
        }}
      >
        <div style={{ padding: "0 20px", borderBottom: "1px solid var(--border)" }}>
          <Tabs
            activeKey={activeTab}
            onChange={setActiveTab}
            items={tabItems}
            style={{ marginBottom: 0 }}
          />
        </div>

        <div style={{ padding: 20 }}>
          {filteredMeetings.length === 0 ? (
            <div
              style={{
                textAlign: "center",
                padding: "48px 20px",
                color: "var(--text-muted)",
              }}
            >
              <CalendarOutlined style={{ fontSize: 40, marginBottom: 12, display: "block" }} />
              <Typography.Text style={{ color: "var(--text-muted)", fontSize: 14 }}>
                Không có cuộc họp nào
              </Typography.Text>
            </div>
          ) : (
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))",
                gap: 16,
              }}
            >
              {filteredMeetings.map(renderMeetingCard)}
            </div>
          )}
        </div>
      </div>

      {/* Invitations section */}
      {invitations.length > 0 && (
        <div
          style={{
            background: "var(--bg-surface)",
            border: "1px solid var(--border)",
            borderRadius: "var(--r-lg)",
            overflow: "hidden",
          }}
        >
          <div
            className="section-card-header"
            style={{ padding: "16px 20px", borderBottom: "1px solid var(--border)", display: "flex", alignItems: "center", justifyContent: "space-between" }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <MailOutlined style={{ color: "var(--accent)", fontSize: 16 }} />
              <span
                style={{ fontSize: 15, fontWeight: 600, color: "var(--text-primary)" }}
              >
                Lời mời đang chờ phản hồi
              </span>
            </div>
            <Badge count={invitations.length} style={{ background: "var(--accent)" }} />
          </div>
          <div style={{ padding: 20 }}>
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))",
                gap: 16,
              }}
            >
              {invitations.map((inv) => {
                const meeting = typeof inv.meetingId === "object" ? inv.meetingId : null;
                return (
                  <div
                    key={inv._id}
                    style={{
                      background: "var(--bg-surface-2)",
                      border: "1px solid var(--border)",
                      borderRadius: "var(--r-md)",
                      padding: 16,
                      cursor: "pointer",
                      transition: "all var(--dur-fast) var(--ease)",
                    }}
                    onClick={() => navigate(`/invitations/${inv._id}`)}
                  >
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 8 }}>
                      <span
                        style={{
                          fontSize: 14,
                          fontWeight: 600,
                          color: "var(--text-primary)",
                        }}
                      >
                        {meeting?.title ?? "Cuộc họp"}
                      </span>
                      <Tag
                        style={{
                          background: "rgba(245, 158, 11, 0.15)",
                          color: "var(--accent-warn)",
                          border: "1px solid rgba(245,158,11,0.25)",
                          borderRadius: "var(--r-xs)",
                          fontSize: 11,
                          margin: 0,
                        }}
                      >
                        Chờ phản hồi
                      </Tag>
                    </div>
                    {meeting && (
                      <div className="meeting-card-meta" style={{ marginBottom: 12 }}>
                        <UserOutlined style={{ fontSize: 11 }} />
                        <span>{getHostLabel(meeting.ownerId)}</span>
                        <span style={{ color: "var(--border-strong)" }}>•</span>
                        <span>{dayjs(meeting.startTime).format("DD/MM/YYYY HH:mm")}</span>
                      </div>
                    )}
                    <Button
                      type="primary"
                      size="small"
                      style={{
                        background: "var(--accent)",
                        borderColor: "var(--accent)",
                        borderRadius: "var(--r-xs)",
                        fontSize: 12,
                      }}
                      onClick={(e) => {
                        e.stopPropagation();
                        navigate(`/invitations/${inv._id}`);
                      }}
                    >
                      Xem &amp; phản hồi
                    </Button>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* Instant meeting modal */}
      <Modal
        title={
          <span style={{ color: "var(--text-primary)", fontWeight: 700 }}>
            <ThunderboltOutlined style={{ color: "var(--accent-warn)", marginRight: 8 }} />
            Họp ngay
          </span>
        }
        open={instantOpen}
        confirmLoading={instantLoading}
        onOk={() => void handleInstantMeeting()}
        onCancel={() => { setInstantOpen(false); setInstantTitle("Cuộc họp tức thì"); }}
        okText="Bắt đầu ngay"
        cancelText="Hủy"
        styles={{ body: { padding: "20px 0 4px" } }}
      >
        <div style={{ marginBottom: 8, color: "var(--text-secondary)", fontSize: 13 }}>
          Tiêu đề cuộc họp
        </div>
        <Input
          value={instantTitle}
          onChange={(e) => setInstantTitle(e.target.value)}
          placeholder="Nhập tiêu đề cuộc họp..."
          onPressEnter={() => void handleInstantMeeting()}
        />
      </Modal>

      {/* Scheduled meeting modal */}
      <Modal
        title={
          <span style={{ color: "var(--text-primary)", fontWeight: 700 }}>
            <PlusOutlined style={{ color: "var(--accent)", marginRight: 8 }} />
            Tạo phòng họp mới
          </span>
        }
        open={createOpen}
        confirmLoading={creating}
        onOk={() => void handleCreateMeeting()}
        onCancel={() => { setCreateOpen(false); createForm.resetFields(); setShowRecurrence(false); }}
        okText="Tạo cuộc họp"
        cancelText="Hủy"
        width={560}
        styles={{ body: { padding: "20px 0 4px", maxHeight: "60vh", overflowY: "auto" } }}
      >
        <Form
          form={createForm}
          layout="vertical"
          initialValues={{
            category: "team_meeting",
            privacyMode: "private",
            waitingRoomEnabled: true,
            isRecurring: false,
            timeRange: [dayjs().add(30, "minute"), dayjs().add(90, "minute")],
          }}
        >
          <Form.Item
            name="title"
            label="Tiêu đề cuộc họp"
            rules={[{ required: true, message: "Vui lòng nhập tiêu đề" }]}
          >
            <Input placeholder="Sprint planning, Team sync..." />
          </Form.Item>

          <Form.Item name="description" label="Mô tả">
            <Input.TextArea rows={2} placeholder="Nội dung / agenda cuộc họp..." />
          </Form.Item>

          <Form.Item
            name="category"
            label="Loại cuộc họp"
            rules={[{ required: true }]}
          >
            <Select
              options={[
                { value: "personal", label: "Cá nhân" },
                { value: "interview", label: "Phỏng vấn" },
                { value: "team_meeting", label: "Họp nhóm" },
                { value: "client_meeting", label: "Khách hàng" },
                { value: "training", label: "Đào tạo" },
              ]}
            />
          </Form.Item>

          <Form.Item
            name="timeRange"
            label="Thời gian bắt đầu / kết thúc"
            rules={[{ required: true, message: "Vui lòng chọn thời gian" }]}
          >
            <DatePicker.RangePicker showTime style={{ width: "100%" }} />
          </Form.Item>

          <Form.Item
            name="privacyMode"
            label="Quyền truy cập"
            rules={[{ required: true }]}
          >
            <Select
              options={[
                { value: "private", label: "Riêng tư (Private)" },
                { value: "public", label: "Công khai (Public)" },
              ]}
            />
          </Form.Item>

          <Form.Item name="waitingRoomEnabled" label="Bật phòng chờ" valuePropName="checked">
            <Switch />
          </Form.Item>

          <Form.Item name="isRecurring" label="Lặp lại định kỳ" valuePropName="checked">
            <Switch onChange={(checked) => setShowRecurrence(checked)} />
          </Form.Item>

          {showRecurrence && (
            <>
              <Form.Item
                name={["recurrence", "frequency"]}
                label="Tần suất lặp"
                rules={[{ required: true, message: "Vui lòng chọn tần suất" }]}
              >
                <Select
                  options={[
                    { value: "daily", label: "Hằng ngày" },
                    { value: "weekly", label: "Hằng tuần" },
                    { value: "monthly", label: "Hằng tháng" },
                  ]}
                />
              </Form.Item>
              <Form.Item
                name={["recurrence", "endDate"]}
                label="Ngày kết thúc chu kỳ lặp"
                rules={[{ required: true, message: "Vui lòng chọn ngày kết thúc" }]}
              >
                <DatePicker showTime style={{ width: "100%" }} placeholder="Chọn ngày kết thúc" />
              </Form.Item>
            </>
          )}
        </Form>
      </Modal>
    </div>
  );
};
