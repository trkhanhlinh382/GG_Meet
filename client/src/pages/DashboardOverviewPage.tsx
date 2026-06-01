import {
  BellOutlined,
  CalendarOutlined,
  LinkOutlined,
  PlusOutlined,
  ThunderboltOutlined,
  VideoCameraOutlined,
} from "@ant-design/icons";
import {
  Button,
  Col,
  DatePicker,
  Form,
  Input,
  List,
  Modal,
  Row,
  Select,
  Space,
  Switch,
  Tag,
  Typography,
  message,
} from "antd";
import dayjs from "dayjs";
import relativeTime from "dayjs/plugin/relativeTime";
dayjs.extend(relativeTime);
import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import type { DashboardPayload } from "../api/types";

// ─── Types ──────────────────────────────────────────────────────────────────

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

interface DashboardOverviewPageProps {
  data?: DashboardPayload;
  onCreateMeeting: (input: CreateMeetingInput) => Promise<void>;
  onJoinMeeting: (rawLink: string) => Promise<void>;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const getHostLabel = (ownerId: DashboardPayload["upcomingMeetings"][number]["ownerId"]) => {
  if (ownerId && typeof ownerId === "object") return ownerId.fullName;
  return "Không rõ host";
};

const CATEGORY_LABELS: Record<string, string> = {
  personal: "Cá nhân",
  interview: "Phỏng vấn",
  team_meeting: "Họp nhóm",
  client_meeting: "Khách hàng",
  training: "Đào tạo",
};

// ─── Component ────────────────────────────────────────────────────────────────

export const DashboardOverviewPage = ({ data, onCreateMeeting, onJoinMeeting }: DashboardOverviewPageProps) => {
  const navigate = useNavigate();
  const [instantOpen, setInstantOpen] = useState(false);
  const [scheduledOpen, setScheduledOpen] = useState(false);
  const [joinOpen, setJoinOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const [joining, setJoining] = useState(false);
  const [instantForm] = Form.useForm();
  const [scheduledForm] = Form.useForm();
  const [joinForm] = Form.useForm();
  const [isRecurring, setIsRecurring] = useState(false);

  const upcoming = data?.upcomingMeetings ?? [];
  const ongoing = data?.ongoingMeetings ?? [];
  const invitations = data?.invitations ?? [];
  const unreadNotifications = useMemo(
    () => (data?.notifications ?? []).filter((n) => !n.isRead).length,
    [data],
  );

  // ─── Instant meeting ─────────────────────────────────────────────────────────

  const handleInstantMeeting = async () => {
    try {
      const values = await instantForm.validateFields();
      setCreating(true);
      await onCreateMeeting({
        title: values.title || "Cuộc họp nhanh",
        category: "team_meeting",
        startTime: new Date().toISOString(),
        endTime: new Date("2099-12-31T23:59:59.999Z").toISOString(),
        privacyMode: "public",
        waitingRoomEnabled: false,
        isInstant: true,
      });
      setInstantOpen(false);
      instantForm.resetFields();
    } catch {
      /* validation error */
    } finally {
      setCreating(false);
    }
  };

  // ─── Scheduled meeting ────────────────────────────────────────────────────────

  const handleScheduledMeeting = async () => {
    try {
      const values = await scheduledForm.validateFields();
      const [start, end] = values.timeRange as [dayjs.Dayjs, dayjs.Dayjs];
      if (start.isBefore(dayjs())) { void message.warning("Thời gian bắt đầu phải ở tương lai"); return; }
      if (!end.isAfter(start)) { void message.warning("Thời gian kết thúc phải sau bắt đầu"); return; }
      setCreating(true);
      await onCreateMeeting({
        title: values.title,
        description: values.description,
        category: values.category,
        startTime: start.toISOString(),
        endTime: end.toISOString(),
        privacyMode: values.privacyMode,
        waitingRoomEnabled: values.waitingRoomEnabled ?? false,
        isRecurring: values.isRecurring,
        recurrence: values.isRecurring
          ? { frequency: values.recurrenceFrequency, endDate: (values.recurrenceEndDate as dayjs.Dayjs).toISOString() }
          : undefined,
      });
      setScheduledOpen(false);
      scheduledForm.resetFields();
      setIsRecurring(false);
    } catch {
      /* validation error */
    } finally {
      setCreating(false);
    }
  };

  // ─── Join by link ─────────────────────────────────────────────────────────────

  const handleJoin = async () => {
    const values = await joinForm.validateFields();
    setJoining(true);
    try {
      await onJoinMeeting(values.linkOrId);
      setJoinOpen(false);
      joinForm.resetFields();
    } finally {
      setJoining(false);
    }
  };

  // ─── Stat cards ────────────────────────────────────────────────────────────────

  const stats = [
    { label: "Đang diễn ra", value: ongoing.length, variant: "success", icon: "🟢" },
    { label: "Sắp tới", value: upcoming.length, variant: "info", icon: "📅" },
    { label: "Lời mời chờ duyệt", value: invitations.length, variant: "warn", icon: "✉️" },
    { label: "Thông báo chưa đọc", value: unreadNotifications, variant: "danger", icon: "🔔" },
  ];

  // ─── Render ─────────────────────────────────────────────────────────────────

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 24 }} className="anim-fade-in">
      {/* Page header */}
      <div className="page-header" style={{ marginBottom: 0 }}>
        <div className="page-title">Tổng quan</div>
        <div className="page-subtitle">
          {dayjs().format("dddd, DD/MM/YYYY")} · Xin chào, hãy bắt đầu ngày làm việc hiệu quả!
        </div>
      </div>

      {/* ── Stat cards ─────────────────────────────────────────────────────────── */}
      <Row gutter={[16, 16]}>
        {stats.map(({ label, value, variant, icon }) => (
          <Col xs={12} md={6} key={label}>
            <div className={`stat-card ${variant}`}>
              <div className={`stat-card-icon ${variant}`}>{icon}</div>
              <div className="stat-card-value">{value}</div>
              <div className="stat-card-label">{label}</div>
            </div>
          </Col>
        ))}
      </Row>

      {/* ── Quick Actions ───────────────────────────────────────────────────────── */}
      <div>
        <Typography.Text style={{ fontSize: 13, fontWeight: 600, color: "var(--text-secondary)", textTransform: "uppercase", letterSpacing: 0.5, display: "block", marginBottom: 12 }}>
          Thao tác nhanh
        </Typography.Text>
        <Row gutter={[12, 12]}>
          {[
            { icon: <ThunderboltOutlined style={{ fontSize: 22, color: "var(--accent-success)" }} />, label: "Họp ngay", sub: "Tạo & vào ngay lập tức", variant: "success", onClick: () => setInstantOpen(true) },
            { icon: <PlusOutlined style={{ fontSize: 22, color: "var(--accent)" }} />, label: "Lên lịch họp", sub: "Chọn thời gian, mời thành viên", variant: "", onClick: () => setScheduledOpen(true) },
            { icon: <LinkOutlined style={{ fontSize: 22, color: "var(--accent-info)" }} />, label: "Tham gia bằng link", sub: "Nhập link hoặc Meeting ID", variant: "", onClick: () => setJoinOpen(true) },
            { icon: <CalendarOutlined style={{ fontSize: 22, color: "var(--accent-warn)" }} />, label: "Xem lịch tháng", sub: "Lịch trình & xung đột lịch", variant: "", onClick: () => navigate("/schedule") },
            { icon: <VideoCameraOutlined style={{ fontSize: 22, color: "var(--accent)" }} />, label: "Tất cả cuộc họp", sub: "Quản lý danh sách họp", variant: "", onClick: () => navigate("/meetings") },
            { icon: <BellOutlined style={{ fontSize: 22, color: "var(--accent-warn)" }} />, label: "Lời mời", sub: `${invitations.length} đang chờ phản hồi`, variant: "", onClick: () => navigate("/meetings") },
          ].map(({ icon, label, sub, variant, onClick }) => (
            <Col xs={12} md={8} key={label}>
              <button className={`quick-action-btn ${variant}`} onClick={onClick}>
                <div className="icon">{icon}</div>
                <div>
                  <div style={{ fontWeight: 600, fontSize: 14 }}>{label}</div>
                  <div style={{ fontSize: 12, color: "var(--text-secondary)", marginTop: 2 }}>{sub}</div>
                </div>
              </button>
            </Col>
          ))}
        </Row>
      </div>

      {/* ── Ongoing meetings ─────────────────────────────────────────────────────── */}
      {ongoing.length > 0 && (
        <div className="section-card">
          <div className="section-card-header">
            <div className="section-card-title">
              <span>🔴</span> Đang diễn ra
            </div>
            <span className="badge-live">LIVE</span>
          </div>
          <div style={{ padding: "12px 20px", display: "flex", flexDirection: "column", gap: 10 }}>
            {ongoing.slice(0, 5).map((meeting) => (
              <div
                key={meeting._id}
                className="meeting-card live"
                onClick={() => navigate(`/meetings/${meeting._id}`)}
              >
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div className="meeting-card-title">{meeting.title}</div>
                    <div className="meeting-card-meta">
                      <span>👤 {getHostLabel(meeting.ownerId)}</span>
                      <span>·</span>
                      <span>🕐 {dayjs(meeting.startTime).format("HH:mm")} – {dayjs(meeting.endTime).format("HH:mm")}</span>
                      {meeting.category && <Tag style={{ margin: 0 }}>{CATEGORY_LABELS[meeting.category] ?? meeting.category}</Tag>}
                    </div>
                  </div>
                  <Button
                    type="primary"
                    size="small"
                    style={{ background: "var(--accent-success)", border: "none", borderRadius: 6, fontWeight: 600, flexShrink: 0, marginLeft: 12 }}
                    onClick={(e) => { e.stopPropagation(); navigate(`/room/${meeting._id}`); }}
                  >
                    Vào họp
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── Upcoming meetings ─────────────────────────────────────────────────────── */}
      <div className="section-card">
        <div className="section-card-header">
          <div className="section-card-title">
            <span>📅</span> Lịch họp sắp tới
          </div>
          <Button type="link" size="small" onClick={() => navigate("/schedule")} style={{ color: "var(--accent)", padding: 0, fontSize: 13 }}>
            Xem lịch tháng →
          </Button>
        </div>
        <div style={{ padding: "12px 20px" }}>
          {upcoming.length === 0 ? (
            <div style={{ textAlign: "center", padding: "32px 0", color: "var(--text-muted)" }}>
              <div style={{ fontSize: 36, marginBottom: 8 }}>📭</div>
              <div>Không có lịch họp sắp tới</div>
              <Button
                type="primary"
                size="small"
                icon={<PlusOutlined />}
                style={{ marginTop: 12, background: "var(--accent)", border: "none" }}
                onClick={() => setScheduledOpen(true)}
              >
                Lên lịch ngay
              </Button>
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {upcoming.slice(0, 6).map((meeting) => {
                const minutesLeft = dayjs(meeting.startTime).diff(dayjs(), "minute");
                return (
                  <div
                    key={meeting._id}
                    className="meeting-card"
                    onClick={() => navigate(`/meetings/${meeting._id}`)}
                  >
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div className="meeting-card-title">{meeting.title}</div>
                        <div className="meeting-card-meta">
                          <span>👤 {getHostLabel(meeting.ownerId)}</span>
                          <span>·</span>
                          <span>📅 {dayjs(meeting.startTime).format("DD/MM HH:mm")}</span>
                          {minutesLeft > 0 && minutesLeft < 60 && (
                            <span style={{ color: "var(--accent-warn)", fontWeight: 600 }}>⏰ Còn {minutesLeft} phút</span>
                          )}
                        </div>
                      </div>
                      <span className="badge-upcoming">Sắp tới</span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* ── Pending invitations ────────────────────────────────────────────────── */}
      {invitations.length > 0 && (
        <div className="section-card">
          <div className="section-card-header">
            <div className="section-card-title">
              <span>✉️</span> Lời mời chờ phản hồi
              <Tag style={{ background: "var(--accent-glow)", color: "var(--accent)", border: "1px solid var(--border-accent)" }}>{invitations.length}</Tag>
            </div>
          </div>
          <div style={{ padding: "12px 20px" }}>
            <List
              dataSource={invitations}
              renderItem={(inv) => {
                const meeting = typeof inv.meetingId === "object" ? inv.meetingId : null;
                return (
                  <List.Item
                    style={{ border: "none", padding: "8px 0" }}
                    actions={[
                      <Button
                        key="view"
                        type="primary"
                        size="small"
                        style={{ background: "var(--accent)", border: "none", borderRadius: 6 }}
                        onClick={() => navigate(`/invitations/${inv._id}`)}
                      >
                        Xem & Phản hồi
                      </Button>,
                    ]}
                  >
                    <List.Item.Meta
                      avatar={<div style={{ width: 36, height: 36, borderRadius: 8, background: "rgba(245,158,11,0.15)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18 }}>✉️</div>}
                      title={<span style={{ color: "var(--text-primary)", fontWeight: 600 }}>{meeting?.title ?? "Cuộc họp"}</span>}
                      description={
                        meeting ? (
                          <span style={{ color: "var(--text-secondary)", fontSize: 12 }}>
                            {dayjs(meeting.startTime).format("DD/MM/YYYY HH:mm")} – {dayjs(meeting.endTime).format("HH:mm")}
                          </span>
                        ) : undefined
                      }
                    />
                  </List.Item>
                );
              }}
            />
          </div>
        </div>
      )}

      {/* ════════════════════════════════════════════════════════════════════════ */}
      {/* Modals                                                                  */}
      {/* ════════════════════════════════════════════════════════════════════════ */}

      {/* Instant meeting */}
      <Modal
        title={<span style={{ color: "var(--text-primary)" }}>⚡ Họp ngay lập tức</span>}
        open={instantOpen}
        confirmLoading={creating}
        onOk={() => void handleInstantMeeting()}
        onCancel={() => { setInstantOpen(false); instantForm.resetFields(); }}
        okText="Tạo & Vào họp"
        okButtonProps={{ style: { background: "var(--accent-success)", border: "none" } }}
      >
        <Form form={instantForm} layout="vertical" style={{ marginTop: 16 }}>
          <Form.Item name="title" label="Tên cuộc họp">
            <Input placeholder="Cuộc họp nhanh" />
          </Form.Item>
        </Form>
        <div style={{ fontSize: 13, color: "var(--text-secondary)", background: "var(--bg-surface-2)", borderRadius: 8, padding: "10px 14px" }}>
          🔓 Công khai · ⏱ Không giới hạn thời gian · Không phòng chờ
        </div>
      </Modal>

      {/* Scheduled meeting */}
      <Modal
        title={<span style={{ color: "var(--text-primary)" }}>📅 Lên lịch cuộc họp</span>}
        open={scheduledOpen}
        confirmLoading={creating}
        onOk={() => void handleScheduledMeeting()}
        onCancel={() => { setScheduledOpen(false); scheduledForm.resetFields(); setIsRecurring(false); }}
        okText="Tạo lịch họp"
        okButtonProps={{ style: { background: "var(--accent)", border: "none" } }}
        width={560}
      >
        <Form
          form={scheduledForm}
          layout="vertical"
          style={{ marginTop: 16 }}
          initialValues={{ category: "team_meeting", privacyMode: "private", waitingRoomEnabled: true, timeRange: [dayjs().add(30, "minute"), dayjs().add(90, "minute")] }}
        >
          <Form.Item name="title" label="Tên cuộc họp" rules={[{ required: true, message: "Nhập tên cuộc họp" }]}>
            <Input placeholder="Sprint planning, Daily standup…" />
          </Form.Item>
          <Form.Item name="description" label="Mô tả">
            <Input.TextArea rows={2} placeholder="Agenda…" />
          </Form.Item>
          <Row gutter={12}>
            <Col span={12}>
              <Form.Item name="category" label="Loại họp" rules={[{ required: true }]}>
                <Select options={[
                  { value: "personal", label: "Cá nhân" },
                  { value: "interview", label: "Phỏng vấn" },
                  { value: "team_meeting", label: "Họp nhóm" },
                  { value: "client_meeting", label: "Khách hàng" },
                  { value: "training", label: "Đào tạo" },
                ]} />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="privacyMode" label="Chế độ" rules={[{ required: true }]}>
                <Select options={[{ value: "private", label: "🔒 Riêng tư" }, { value: "public", label: "🌐 Công khai" }]} />
              </Form.Item>
            </Col>
          </Row>
          <Form.Item name="timeRange" label="Thời gian bắt đầu – kết thúc" rules={[{ required: true, message: "Chọn thời gian" }]}>
            <DatePicker.RangePicker showTime style={{ width: "100%" }} format="DD/MM/YYYY HH:mm" />
          </Form.Item>
          <Space>
            <Form.Item name="waitingRoomEnabled" label="Phòng chờ" valuePropName="checked">
              <Switch />
            </Form.Item>
            <Form.Item name="isRecurring" label="Lặp lại" valuePropName="checked">
              <Switch onChange={setIsRecurring} />
            </Form.Item>
          </Space>
          {isRecurring && (
            <Row gutter={12}>
              <Col span={12}>
                <Form.Item name="recurrenceFrequency" label="Tần suất" rules={[{ required: true }]}>
                  <Select options={[{ value: "daily", label: "Hàng ngày" }, { value: "weekly", label: "Hàng tuần" }, { value: "monthly", label: "Hàng tháng" }]} />
                </Form.Item>
              </Col>
              <Col span={12}>
                <Form.Item name="recurrenceEndDate" label="Kết thúc lặp" rules={[{ required: true }]}>
                  <DatePicker style={{ width: "100%" }} format="DD/MM/YYYY" />
                </Form.Item>
              </Col>
            </Row>
          )}
        </Form>
      </Modal>

      {/* Join by link */}
      <Modal
        title={<span style={{ color: "var(--text-primary)" }}>🔗 Tham gia bằng link</span>}
        open={joinOpen}
        confirmLoading={joining}
        onOk={() => void handleJoin()}
        onCancel={() => { setJoinOpen(false); joinForm.resetFields(); }}
        okText="Tham gia"
        okButtonProps={{ style: { background: "var(--accent)", border: "none" } }}
      >
        <Form form={joinForm} layout="vertical" style={{ marginTop: 16 }}>
          <Form.Item name="linkOrId" label="Link hoặc Meeting ID" rules={[{ required: true, message: "Nhập link hoặc ID" }]}>
            <Input placeholder="https://… hoặc meeting-id" />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
};
