import {
  ArrowLeftOutlined,
  CommentOutlined,
  EditOutlined,
  InfoCircleOutlined,
  TeamOutlined,
} from "@ant-design/icons";
import {
  Alert,
  Avatar,
  Button,
  Card,
  Col,
  DatePicker,
  Form,
  Input,
  Modal,
  Popconfirm,
  Popover,
  Row,
  Select,
  Space,
  Spin,
  Switch,
  Tabs,
  Tag,
  Typography,
  message,
} from "antd";
import type { AxiosError } from "axios";
import dayjs from "dayjs";
import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { http } from "../api/http";
import type { MeetingDetailsPayload } from "../api/types";

/* ─── Types ─────────────────────────────────────────────────── */
interface SessionUser {
  id: string;
  fullName: string;
  email: string;
}

interface MeetingDetailPageProps {
  token: string;
  user: SessionUser;
}

/* ─── Helpers ───────────────────────────────────────────────── */
const STICKERS = ["🐱", "🐶", "🚀", "🎉", "👍", "❤️", "😂", "😮", "🔥", "💯", "👏", "💩"];

const categoryLabel = (cat: string) => {
  const map: Record<string, string> = {
    personal: "Cá nhân",
    interview: "Phỏng vấn",
    team_meeting: "Team Meeting",
    client_meeting: "Khách hàng",
    training: "Đào tạo",
  };
  return map[cat] ?? cat;
};

/* ═══════════════════════════════════════════════════════════════
   Component
   ═══════════════════════════════════════════════════════════════ */
export const MeetingDetailPage = ({ token, user }: MeetingDetailPageProps) => {
  const { id } = useParams();
  const navigate = useNavigate();

  /* ─── State ──────────────────────────────────────────────── */
  const [detail, setDetail] = useState<MeetingDetailsPayload>();
  const [loading, setLoading] = useState(false);
  const [inviting, setInviting] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [updating, setUpdating] = useState(false);
  const [chatText, setChatText] = useState("");
  const [sendingChat, setSendingChat] = useState(false);
  const [stickerPopoverOpen, setStickerPopoverOpen] = useState(false);

  const [form] = Form.useForm();
  const [editForm] = Form.useForm();
  const messagesEndRef = useRef<HTMLDivElement>(null);

  /* ─── Scroll to bottom when messages change ──────────────── */
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };
  useEffect(() => {
    scrollToBottom();
  }, [detail?.messages]);

  /* ─── Load details ───────────────────────────────────────── */
  const loadDetail = async () => {
    if (!id) return;
    setLoading(true);
    try {
      const response = await http.get<MeetingDetailsPayload>(`/meetings/${id}/details`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      setDetail(response.data);
    } catch {
      message.error("Không tải được chi tiết cuộc họp");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadDetail();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, token]);

  /* ─── Derived state ──────────────────────────────────────── */
  const status = useMemo(() => {
    if (!detail?.meeting) return "unknown" as const;
    const now = Date.now();
    const start = new Date(detail.meeting.startTime).getTime();
    const end = new Date(detail.meeting.endTime).getTime();
    if (detail.meeting.status === "ended" || detail.meeting.status === "cancelled" || end < now) {
      return "ended" as const;
    }
    if (start > now) return "upcoming" as const;
    return "ongoing" as const;
  }, [detail?.meeting]);

  const ownerIdStr = useMemo(() => {
    if (!detail?.meeting?.ownerId) return "";
    if (typeof detail.meeting.ownerId === "object") {
      return (detail.meeting.ownerId as any)._id || (detail.meeting.ownerId as any).id || "";
    }
    return detail.meeting.ownerId;
  }, [detail?.meeting?.ownerId]);

  const isOwner = useMemo(() => ownerIdStr === user.id, [ownerIdStr, user.id]);
  const canInvite = useMemo(
    () => (status === "upcoming" || status === "ongoing") && isOwner,
    [status, isOwner],
  );

  const pinnedMessages = useMemo(
    () => (detail?.messages ?? []).filter((msg) => msg.isPinned),
    [detail?.messages],
  );

  /* ─── Invite member ──────────────────────────────────────── */
  const handleInvite = async () => {
    if (!id) return;
    const values = await form.validateFields();
    setInviting(true);
    try {
      await http.post(
        `/meetings/${id}/invite`,
        { participantEmails: [values.email] },
        { headers: { Authorization: `Bearer ${token}` } },
      );
      message.success("Đã gửi lời mời");
      form.resetFields();
      await loadDetail();
    } catch (error) {
      const axiosError = error as AxiosError<{ message?: string; missingEmails?: string[] }>;
      if (axiosError.response?.status === 404 && axiosError.response.data?.missingEmails?.length) {
        message.error(`Không tìm thấy email: ${axiosError.response.data.missingEmails.join(", ")}`);
      } else {
        message.error(axiosError.response?.data?.message ?? "Không thể mời thành viên");
      }
    } finally {
      setInviting(false);
    }
  };

  /* ─── Edit meeting ───────────────────────────────────────── */
  const handleOpenEdit = () => {
    if (!detail?.meeting) return;
    const start = dayjs(detail.meeting.startTime);
    const end = dayjs(detail.meeting.endTime);
    const isInfinite = end.year() > 2090;
    const duration = isInfinite ? "infinite" : end.diff(start, "minute");

    editForm.setFieldsValue({
      title: detail.meeting.title,
      description: detail.meeting.description,
      category: detail.meeting.category,
      startTime: start,
      duration: duration,
      privacyMode: detail.meeting.privacyMode,
      waitingRoomEnabled: detail.meeting.waitingRoomEnabled,
      recordingEnabled: detail.meeting.recordingEnabled,
    });
    setEditOpen(true);
  };

  const handleSaveEdit = async () => {
    if (!id) return;
    try {
      const values = await editForm.validateFields();
      const start = values.startTime as dayjs.Dayjs;
      const duration = values.duration;
      
      let endTimeStr = "2099-12-31T23:59:59Z";
      if (duration && duration !== "infinite") {
        endTimeStr = start.add(Number(duration), "minute").toISOString();
      }

      setUpdating(true);
      await http.put(
        `/meetings/${id}`,
        {
          title: values.title,
          description: values.description,
          category: values.category,
          startTime: start.toISOString(),
          endTime: endTimeStr,
          privacyMode: values.privacyMode,
          waitingRoomEnabled: values.waitingRoomEnabled,
          recordingEnabled: values.recordingEnabled,
        },
        { headers: { Authorization: `Bearer ${token}` } },
      );
      message.success("Cập nhật thông tin cuộc họp thành công");
      setEditOpen(false);
      await loadDetail();
    } catch (error) {
      const axiosError = error as AxiosError<{ message?: string }>;
      message.error(axiosError.response?.data?.message ?? "Không thể cập nhật cuộc họp");
    } finally {
      setUpdating(false);
    }
  };

  /* ─── End / Reopen meeting ───────────────────────────────── */
  const handleEndMeeting = async () => {
    if (!id) return;
    try {
      setLoading(true);
      await http.post(`/meetings/${id}/end`, {}, { headers: { Authorization: `Bearer ${token}` } });
      message.success("Đã kết thúc cuộc họp");
      await loadDetail();
    } catch (err: any) {
      message.error(err?.response?.data?.message || "Không thể kết thúc cuộc họp");
    } finally {
      setLoading(false);
    }
  };

  const handleReopenMeeting = async () => {
    if (!id) return;
    try {
      setLoading(true);
      await http.post(
        `/meetings/${id}/reopen`,
        {},
        { headers: { Authorization: `Bearer ${token}` } },
      );
      message.success("Đã mở lại cuộc họp thành công");
      await loadDetail();
    } catch (err: any) {
      message.error(err?.response?.data?.message || "Không thể mở lại cuộc họp");
    } finally {
      setLoading(false);
    }
  };

  /* ─── Delete meeting ─────────────────────────────────────── */
  const handleDeleteMeeting = async () => {
    if (!id) return;
    try {
      setLoading(true);
      await http.delete(`/meetings/${id}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      message.success("Xóa cuộc họp thành công");
      navigate("/meetings");
    } catch (err: any) {
      message.error(err?.response?.data?.message || "Không thể xóa cuộc họp");
      setLoading(false);
    }
  };

  /* ─── Kick user ──────────────────────────────────────────── */
  const handleKickUser = async (targetUserId: string) => {
    if (!id) return;
    try {
      await http.delete(`/meetings/${id}/kick/${targetUserId}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      message.success("Đã xóa thành viên khỏi cuộc họp");
      await loadDetail();
    } catch (err: any) {
      message.error(err?.response?.data?.message || "Không thể kick thành viên");
    }
  };

  /* ─── Chat ───────────────────────────────────────────────── */
  const handleSendChatMessage = async (
    customText?: string,
    fileData?: string,
    fileName?: string,
    fileType?: string,
    sticker?: string,
  ) => {
    if (!id) return;
    const textToSend = customText !== undefined ? customText : chatText;
    if (!textToSend.trim() && !fileData && !sticker) return;

    setSendingChat(true);
    try {
      await http.post(
        `/meetings/${id}/messages`,
        { message: textToSend, fileData, fileName, fileType, sticker },
        { headers: { Authorization: `Bearer ${token}` } },
      );
      if (customText === undefined) setChatText("");
      const response = await http.get<MeetingDetailsPayload>(`/meetings/${id}/details`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      setDetail(response.data);
    } catch (err: any) {
      message.error(err?.response?.data?.message || "Không gửi được tin nhắn");
    } finally {
      setSendingChat(false);
    }
  };

  /* ─── Pin message ────────────────────────────────────────── */
  const handleTogglePinMessage = async (messageId: string) => {
    if (!id) return;
    try {
      await http.patch(
        `/meetings/${id}/messages/${messageId}/pin`,
        {},
        { headers: { Authorization: `Bearer ${token}` } },
      );
      const response = await http.get<MeetingDetailsPayload>(`/meetings/${id}/details`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      setDetail(response.data);
      message.success("Cập nhật ghim tin nhắn thành công");
    } catch (err: any) {
      message.error(err?.response?.data?.message || "Không thể ghim/bỏ ghim tin nhắn");
    }
  };

  /* ─── Status badge ───────────────────────────────────────── */
  const statusBadge =
    status === "ended" ? (
      <span className="badge-ended">Đã kết thúc</span>
    ) : status === "upcoming" ? (
      <span className="badge-upcoming">Sắp diễn ra</span>
    ) : (
      <span
        className="badge-live"
        style={{ cursor: "pointer" }}
        onClick={() => navigate(`/room/${id}`)}
      >
        Đang diễn ra · Vào họp
      </span>
    );

  /* ─── Loading spinner ────────────────────────────────────── */
  if (loading && !detail) {
    return (
      <div className="loading-shell">
        <Spin size="large" />
        <Typography.Text style={{ color: "var(--text-secondary)" }}>
          Đang tải chi tiết cuộc họp...
        </Typography.Text>
      </div>
    );
  }

  /* ═══ RENDER ═══════════════════════════════════════════════ */
  return (
    <Space direction="vertical" size={20} style={{ width: "100%" }}>
      {/* Top bar */}
      <div className="flex-between" style={{ flexWrap: "wrap", gap: 12 }}>
        <Space>
          <Button
            icon={<ArrowLeftOutlined />}
            onClick={() => navigate("/meetings")}
            style={{ background: "var(--bg-surface-2)", borderColor: "var(--border-strong)" }}
          >
            Quay lại
          </Button>
          <Typography.Title level={4} style={{ margin: 0, color: "var(--text-primary)" }}>
            Chi tiết cuộc họp
          </Typography.Title>
        </Space>
        {isOwner && (status === "upcoming" || status === "ongoing") && (
          <Button
            type="primary"
            icon={<EditOutlined />}
            onClick={handleOpenEdit}
          >
            Chỉnh sửa
          </Button>
        )}
      </div>

      {/* Main card with tabs */}
      <Card
        loading={loading}
        styles={{ body: { padding: "0 0 20px 0" } }}
        style={{
          background: "var(--bg-surface)",
          border: "1px solid var(--border)",
          borderRadius: "var(--r-lg)",
        }}
      >
        <Tabs
          defaultActiveKey="overview"
          style={{ padding: "0 20px" }}
          items={[
            /* ══════════════════════════════════════════════════
               TAB 1 — OVERVIEW
               ══════════════════════════════════════════════════ */
            {
              key: "overview",
              label: (
                <span>
                  <InfoCircleOutlined /> Tổng quát
                </span>
              ),
              children: (
                <div style={{ paddingTop: 16 }}>
                  {/* Title + status + actions row */}
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "flex-start",
                      flexWrap: "wrap",
                      gap: 12,
                      marginBottom: 24,
                    }}
                  >
                    <div>
                      <Typography.Title
                        level={3}
                        style={{ margin: "0 0 8px 0", color: "var(--text-primary)" }}
                      >
                        {detail?.meeting?.title ?? "Chi tiết cuộc họp"}
                      </Typography.Title>
                      {statusBadge}
                    </div>

                    {isOwner && (
                      <Space wrap size={8}>
                        {status === "ongoing" && (
                          <Popconfirm
                            title="Kết thúc cuộc họp?"
                            description="Hành động này sẽ kết thúc cuộc họp ngay lập tức."
                            okText="Kết thúc"
                            okType="danger"
                            cancelText="Hủy"
                            onConfirm={() => void handleEndMeeting()}
                          >
                            <Button danger type="primary">
                              Kết thúc cuộc họp
                            </Button>
                          </Popconfirm>
                        )}
                        {status === "ended" && (
                          <Button
                            type="primary"
                            onClick={() => void handleReopenMeeting()}
                            style={{
                              background: "var(--accent-success)",
                              borderColor: "var(--accent-success)",
                            }}
                          >
                            Mở lại cuộc họp
                          </Button>
                        )}
                        <Popconfirm
                          title="Xóa cuộc họp?"
                          description="Hành động này không thể hoàn tác."
                          okText="Xóa"
                          okType="danger"
                          cancelText="Hủy"
                          onConfirm={() => void handleDeleteMeeting()}
                        >
                          <Button danger>Xóa cuộc họp</Button>
                        </Popconfirm>
                      </Space>
                    )}
                  </div>

                  {detail?.meeting ? (
                    <div>
                      {/* Description */}
                      {detail.meeting.description && (
                        <div
                          style={{
                            background: "var(--bg-surface-2)",
                            border: "1px solid var(--border)",
                            borderRadius: "var(--r-md)",
                            padding: "14px 16px",
                            marginBottom: 20,
                            color: "var(--text-secondary)",
                            fontSize: 14,
                            lineHeight: 1.7,
                            whiteSpace: "pre-wrap",
                          }}
                        >
                          {detail.meeting.description}
                        </div>
                      )}

                      {/* Info grid */}
                      <Row gutter={[16, 16]}>
                        {/* Start time */}
                        <Col xs={24} sm={12}>
                          <div
                            style={{
                              background: "var(--bg-surface-2)",
                              border: "1px solid var(--border)",
                              borderRadius: "var(--r-md)",
                              padding: "14px 16px",
                            }}
                          >
                            <Typography.Text
                              style={{
                                fontSize: 11,
                                color: "var(--text-muted)",
                                fontWeight: 600,
                                textTransform: "uppercase",
                                letterSpacing: "0.5px",
                                display: "block",
                                marginBottom: 4,
                              }}
                            >
                              🕐 Thời gian bắt đầu
                            </Typography.Text>
                            <Typography.Text
                              style={{ color: "var(--text-primary)", fontWeight: 500 }}
                            >
                              {dayjs(detail.meeting.startTime).format("DD/MM/YYYY HH:mm")}
                            </Typography.Text>
                          </div>
                        </Col>

                        {/* End time */}
                        <Col xs={24} sm={12}>
                          <div
                            style={{
                              background: "var(--bg-surface-2)",
                              border: "1px solid var(--border)",
                              borderRadius: "var(--r-md)",
                              padding: "14px 16px",
                            }}
                          >
                            <Typography.Text
                              style={{
                                fontSize: 11,
                                color: "var(--text-muted)",
                                fontWeight: 600,
                                textTransform: "uppercase",
                                letterSpacing: "0.5px",
                                display: "block",
                                marginBottom: 4,
                              }}
                            >
                              🕔 Thời gian kết thúc
                            </Typography.Text>
                            <Typography.Text
                              style={{ color: "var(--text-primary)", fontWeight: 500 }}
                            >
                              {dayjs(detail.meeting.endTime).year() > 2090
                                ? "Vô hạn (Không giới hạn)"
                                : dayjs(detail.meeting.endTime).format("DD/MM/YYYY HH:mm")}
                            </Typography.Text>
                          </div>
                        </Col>

                        {/* Category */}
                        <Col xs={24} sm={12}>
                          <div
                            style={{
                              background: "var(--bg-surface-2)",
                              border: "1px solid var(--border)",
                              borderRadius: "var(--r-md)",
                              padding: "14px 16px",
                            }}
                          >
                            <Typography.Text
                              style={{
                                fontSize: 11,
                                color: "var(--text-muted)",
                                fontWeight: 600,
                                textTransform: "uppercase",
                                letterSpacing: "0.5px",
                                display: "block",
                                marginBottom: 4,
                              }}
                            >
                              🏷️ Loại cuộc họp
                            </Typography.Text>
                            <Tag
                              style={{
                                background: "rgba(99,102,241,0.12)",
                                color: "var(--accent)",
                                border: "1px solid rgba(99,102,241,0.25)",
                              }}
                            >
                              {categoryLabel(detail.meeting.category)}
                            </Tag>
                          </div>
                        </Col>

                        {/* Privacy */}
                        <Col xs={24} sm={12}>
                          <div
                            style={{
                              background: "var(--bg-surface-2)",
                              border: "1px solid var(--border)",
                              borderRadius: "var(--r-md)",
                              padding: "14px 16px",
                            }}
                          >
                            <Typography.Text
                              style={{
                                fontSize: 11,
                                color: "var(--text-muted)",
                                fontWeight: 600,
                                textTransform: "uppercase",
                                letterSpacing: "0.5px",
                                display: "block",
                                marginBottom: 4,
                              }}
                            >
                              🔒 Quyền truy cập
                            </Typography.Text>
                            <Tag
                              style={{
                                background:
                                  detail.meeting.privacyMode === "private"
                                    ? "rgba(239,68,68,0.12)"
                                    : "rgba(34,197,94,0.12)",
                                color:
                                  detail.meeting.privacyMode === "private"
                                    ? "var(--accent-danger)"
                                    : "var(--accent-success)",
                                border: `1px solid ${
                                  detail.meeting.privacyMode === "private"
                                    ? "rgba(239,68,68,0.25)"
                                    : "rgba(34,197,94,0.25)"
                                }`,
                              }}
                            >
                              {detail.meeting.privacyMode === "private"
                                ? "🔒 Riêng tư"
                                : "🌐 Công khai"}
                            </Tag>
                          </div>
                        </Col>

                        {/* Waiting room */}
                        <Col xs={24} sm={12}>
                          <div
                            style={{
                              background: "var(--bg-surface-2)",
                              border: "1px solid var(--border)",
                              borderRadius: "var(--r-md)",
                              padding: "14px 16px",
                            }}
                          >
                            <Typography.Text
                              style={{
                                fontSize: 11,
                                color: "var(--text-muted)",
                                fontWeight: 600,
                                textTransform: "uppercase",
                                letterSpacing: "0.5px",
                                display: "block",
                                marginBottom: 4,
                              }}
                            >
                              ⏳ Phòng chờ
                            </Typography.Text>
                            <Tag
                              style={{
                                background: detail.meeting.waitingRoomEnabled
                                  ? "rgba(245,158,11,0.12)"
                                  : "rgba(71,85,105,0.15)",
                                color: detail.meeting.waitingRoomEnabled
                                  ? "var(--accent-warn)"
                                  : "var(--text-muted)",
                                border: `1px solid ${
                                  detail.meeting.waitingRoomEnabled
                                    ? "rgba(245,158,11,0.25)"
                                    : "var(--border)"
                                }`,
                              }}
                            >
                              {detail.meeting.waitingRoomEnabled ? "Bật" : "Tắt"}
                            </Tag>
                          </div>
                        </Col>

                        {/* Recording */}
                        <Col xs={24} sm={12}>
                          <div
                            style={{
                              background: "var(--bg-surface-2)",
                              border: "1px solid var(--border)",
                              borderRadius: "var(--r-md)",
                              padding: "14px 16px",
                            }}
                          >
                            <Typography.Text
                              style={{
                                fontSize: 11,
                                color: "var(--text-muted)",
                                fontWeight: 600,
                                textTransform: "uppercase",
                                letterSpacing: "0.5px",
                                display: "block",
                                marginBottom: 4,
                              }}
                            >
                              🎥 Ghi hình
                            </Typography.Text>
                            <Tag
                              style={{
                                background: detail.meeting.recordingEnabled
                                  ? "rgba(239,68,68,0.12)"
                                  : "rgba(71,85,105,0.15)",
                                color: detail.meeting.recordingEnabled
                                  ? "var(--accent-danger)"
                                  : "var(--text-muted)",
                                border: `1px solid ${
                                  detail.meeting.recordingEnabled
                                    ? "rgba(239,68,68,0.25)"
                                    : "var(--border)"
                                }`,
                              }}
                            >
                              {detail.meeting.recordingEnabled ? "Đang ghi" : "Không ghi"}
                            </Tag>
                          </div>
                        </Col>
                      </Row>
                    </div>
                  ) : (
                    <div className="loading-shell">
                      <Typography.Text style={{ color: "var(--text-muted)" }}>
                        Không có dữ liệu cuộc họp.
                      </Typography.Text>
                    </div>
                  )}
                </div>
              ),
            },

            /* ══════════════════════════════════════════════════
               TAB 2 — MEMBERS
               ══════════════════════════════════════════════════ */
            {
              key: "members",
              label: (
                <span>
                  <TeamOutlined /> Thành viên ({(detail?.invitations?.length ?? 0) + 1})
                </span>
              ),
              children: (
                <div style={{ paddingTop: 16 }}>
                  {/* Waiting requests alert */}
                  {isOwner && (detail?.waitingRequests ?? []).length > 0 && (
                    <Alert
                      type="warning"
                      showIcon
                      message="Có người đang chờ duyệt vào phòng"
                      description="Nhấn vào badge 'Đang diễn ra · Vào họp' ở tab Tổng quát để truy cập phòng họp và duyệt yêu cầu tham gia."
                      style={{ marginBottom: 16, borderRadius: "var(--r-sm)" }}
                    />
                  )}

                  {/* Header + invite form */}
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                      flexWrap: "wrap",
                      gap: 12,
                      marginBottom: 16,
                    }}
                  >
                    <Typography.Title
                      level={5}
                      style={{ margin: 0, color: "var(--text-primary)" }}
                    >
                      Danh sách người tham gia
                    </Typography.Title>
                    {canInvite && (
                      <Form layout="inline" form={form}>
                        <Form.Item
                          name="email"
                          rules={[
                            { required: true, message: "Nhập email" },
                            { type: "email", message: "Email không hợp lệ" },
                          ]}
                          style={{ marginBottom: 0 }}
                        >
                          <Input
                            placeholder="Mời thành viên qua email..."
                            size="middle"
                            style={{ width: 230 }}
                          />
                        </Form.Item>
                        <Button
                          type="primary"
                          loading={inviting}
                          onClick={() => void handleInvite()}
                        >
                          Mời
                        </Button>
                      </Form>
                    )}
                  </div>

                  <Row gutter={[12, 12]}>
                    {/* Host card */}
                    {detail?.meeting && (
                      <Col xs={24} sm={12} md={8} lg={6}>
                        <Card
                          size="small"
                          styles={{ body: { padding: 12 } }}
                          style={{
                            borderRadius: "var(--r-md)",
                            border: "1px solid rgba(250,219,20,0.3)",
                            background: "rgba(250,219,20,0.06)",
                          }}
                        >
                          <div style={{ display: "flex", gap: 12, alignItems: "flex-start" }}>
                            <Avatar
                              style={{ background: "rgba(250,219,20,0.2)", flexShrink: 0 }}
                            >
                              👑
                            </Avatar>
                            <div style={{ flex: 1, minWidth: 0 }}>
                              <Typography.Text
                                strong
                                style={{
                                  display: "block",
                                  fontSize: 13,
                                  color: "var(--text-primary)",
                                }}
                              >
                                {typeof detail.meeting.ownerId === "object"
                                  ? (detail.meeting.ownerId as any).fullName
                                  : "Host"}
                              </Typography.Text>
                              <Typography.Text
                                style={{
                                  fontSize: 11,
                                  color: "var(--text-muted)",
                                  display: "block",
                                  overflow: "hidden",
                                  textOverflow: "ellipsis",
                                  whiteSpace: "nowrap",
                                }}
                              >
                                {typeof detail.meeting.ownerId === "object"
                                  ? (detail.meeting.ownerId as any).email
                                  : "Chủ cuộc họp"}
                              </Typography.Text>
                              <Tag
                                style={{
                                  marginTop: 6,
                                  background: "rgba(250,219,20,0.15)",
                                  color: "#fadb14",
                                  border: "1px solid rgba(250,219,20,0.3)",
                                  fontSize: 10,
                                }}
                              >
                                Chủ phòng · Host
                              </Tag>
                            </div>
                          </div>
                        </Card>
                      </Col>
                    )}

                    {/* Invited member cards */}
                    {(detail?.invitations ?? []).map((item) => {
                      const invitedUser =
                        typeof item.userId === "object" ? item.userId : null;
                      const statusColor =
                        item.status === "accepted"
                          ? { bg: "rgba(34,197,94,0.12)", text: "var(--accent-success)", border: "rgba(34,197,94,0.25)" }
                          : item.status === "rejected"
                          ? { bg: "rgba(239,68,68,0.12)", text: "var(--accent-danger)", border: "rgba(239,68,68,0.25)" }
                          : item.status === "maybe"
                          ? { bg: "rgba(56,189,248,0.12)", text: "var(--accent-info)", border: "rgba(56,189,248,0.25)" }
                          : { bg: "rgba(245,158,11,0.12)", text: "var(--accent-warn)", border: "rgba(245,158,11,0.25)" };
                      const statusLabel =
                        item.status === "accepted"
                          ? "Đã đồng ý"
                          : item.status === "rejected"
                          ? "Từ chối"
                          : item.status === "maybe"
                          ? "Có thể"
                          : "Chưa phản hồi";

                      return (
                        <Col xs={24} sm={12} md={8} lg={6} key={item._id}>
                          <Card
                            size="small"
                            styles={{ body: { padding: 12 } }}
                            style={{
                              borderRadius: "var(--r-md)",
                              border: "1px solid var(--border)",
                              background: "var(--bg-surface-2)",
                            }}
                          >
                            <div style={{ display: "flex", gap: 12, alignItems: "flex-start" }}>
                              <Avatar
                                style={{
                                  background: "rgba(99,102,241,0.2)",
                                  color: "var(--accent)",
                                  flexShrink: 0,
                                  fontSize: 13,
                                  fontWeight: 700,
                                }}
                              >
                                {(invitedUser?.fullName ?? "U").charAt(0).toUpperCase()}
                              </Avatar>
                              <div style={{ flex: 1, minWidth: 0 }}>
                                <Typography.Text
                                  strong
                                  style={{
                                    display: "block",
                                    fontSize: 13,
                                    color: "var(--text-primary)",
                                  }}
                                >
                                  {invitedUser?.fullName ?? "Người dùng"}
                                </Typography.Text>
                                <Typography.Text
                                  style={{
                                    fontSize: 11,
                                    color: "var(--text-muted)",
                                    display: "block",
                                    overflow: "hidden",
                                    textOverflow: "ellipsis",
                                    whiteSpace: "nowrap",
                                  }}
                                >
                                  {invitedUser?.email ?? "Không có email"}
                                </Typography.Text>
                                <div
                                  style={{
                                    display: "flex",
                                    justifyContent: "space-between",
                                    alignItems: "center",
                                    marginTop: 8,
                                    gap: 4,
                                  }}
                                >
                                  <Tag
                                    style={{
                                      fontSize: 10,
                                      background: statusColor.bg,
                                      color: statusColor.text,
                                      border: `1px solid ${statusColor.border}`,
                                    }}
                                  >
                                    {statusLabel}
                                  </Tag>
                                  {isOwner && invitedUser && (
                                    <Popconfirm
                                      title={`Kick ${invitedUser.fullName}?`}
                                      okText="Kick"
                                      okType="danger"
                                      cancelText="Hủy"
                                      onConfirm={() => void handleKickUser(invitedUser._id)}
                                    >
                                      <Button
                                        danger
                                        type="text"
                                        size="small"
                                        style={{ padding: "0 4px", fontSize: 11 }}
                                      >
                                        Kick
                                      </Button>
                                    </Popconfirm>
                                  )}
                                </div>
                              </div>
                            </div>
                          </Card>
                        </Col>
                      );
                    })}

                    {/* Waiting request cards (host only) */}
                    {isOwner &&
                      (detail?.waitingRequests ?? []).map((item) => (
                        <Col xs={24} sm={12} md={8} lg={6} key={item.socketId}>
                          <Card
                            size="small"
                            styles={{ body: { padding: 12 } }}
                            style={{
                              borderRadius: "var(--r-md)",
                              border: "1px solid rgba(245,158,11,0.3)",
                              background: "rgba(245,158,11,0.06)",
                            }}
                          >
                            <div style={{ display: "flex", gap: 12, alignItems: "flex-start" }}>
                              <Avatar
                                style={{
                                  background: "rgba(245,158,11,0.2)",
                                  color: "var(--accent-warn)",
                                  flexShrink: 0,
                                }}
                              >
                                ⏳
                              </Avatar>
                              <div>
                                <Typography.Text
                                  strong
                                  style={{
                                    display: "block",
                                    fontSize: 13,
                                    color: "var(--text-primary)",
                                  }}
                                >
                                  {item.name}
                                </Typography.Text>
                                <Tag
                                  style={{
                                    marginTop: 4,
                                    fontSize: 10,
                                    background: "rgba(245,158,11,0.12)",
                                    color: "var(--accent-warn)",
                                    border: "1px solid rgba(245,158,11,0.25)",
                                  }}
                                >
                                  Đang ở phòng chờ
                                </Tag>
                              </div>
                            </div>
                          </Card>
                        </Col>
                      ))}
                  </Row>
                </div>
              ),
            },

            /* ══════════════════════════════════════════════════
               TAB 3 — CHAT
               ══════════════════════════════════════════════════ */
            {
              key: "chat",
              label: (
                <span>
                  <CommentOutlined /> Tin nhắn cuộc họp
                </span>
              ),
              children: (
                <div style={{ paddingTop: 16 }}>
                  <Row gutter={[16, 16]}>
                    {/* Chat column */}
                    <Col xs={24} lg={16}>
                      <Typography.Title
                        level={5}
                        style={{ marginBottom: 12, color: "var(--text-primary)" }}
                      >
                        Kênh thảo luận trước cuộc họp
                      </Typography.Title>

                      <div
                        style={{
                          display: "flex",
                          flexDirection: "column",
                          height: 540,
                          border: "1px solid var(--border)",
                          borderRadius: "var(--r-md)",
                          background: "var(--bg-base)",
                          overflow: "hidden",
                        }}
                      >
                        {/* Pinned messages banner */}
                        {pinnedMessages.length > 0 && (
                          <div
                            style={{
                              padding: "8px 14px",
                              background: "rgba(245,158,11,0.08)",
                              borderBottom: "1px solid rgba(245,158,11,0.2)",
                              maxHeight: 100,
                              overflowY: "auto",
                              display: "flex",
                              flexDirection: "column",
                              gap: 4,
                            }}
                          >
                            <div
                              style={{
                                fontSize: 11,
                                fontWeight: 700,
                                color: "var(--accent-warn)",
                                textTransform: "uppercase",
                                letterSpacing: "0.5px",
                                marginBottom: 4,
                              }}
                            >
                              📌 Tin nhắn đã ghim ({pinnedMessages.length})
                            </div>
                            {pinnedMessages.map((pm) => (
                              <div
                                key={pm._id}
                                className="chat-pinned-banner"
                                style={{ justifyContent: "space-between" }}
                              >
                                <span
                                  style={{
                                    overflow: "hidden",
                                    textOverflow: "ellipsis",
                                    whiteSpace: "nowrap",
                                    flex: 1,
                                    marginRight: 8,
                                  }}
                                >
                                  <strong>{pm.senderName}:</strong>{" "}
                                  {pm.message ||
                                    (pm.sticker ? `[${pm.sticker}]` : "📁 [Tệp đính kèm]")}
                                </span>
                                <Button
                                  type="text"
                                  size="small"
                                  onClick={() => void handleTogglePinMessage(pm._id)}
                                  style={{
                                    padding: "0 4px",
                                    height: "auto",
                                    fontSize: 11,
                                    color: "var(--accent-danger)",
                                  }}
                                >
                                  Bỏ ghim
                                </Button>
                              </div>
                            ))}
                          </div>
                        )}

                        {/* Messages scroll area */}
                        <div className="chat-area" style={{ flex: 1 }}>
                          {(detail?.messages ?? []).length === 0 ? (
                            <div
                              style={{
                                display: "flex",
                                flex: 1,
                                alignItems: "center",
                                justifyContent: "center",
                                color: "var(--text-muted)",
                                fontSize: 13,
                                flexDirection: "column",
                                gap: 8,
                                height: "100%",
                              }}
                            >
                              <span style={{ fontSize: 32 }}>💬</span>
                              Chưa có tin nhắn nào. Hãy soạn tin nhắn đầu tiên!
                            </div>
                          ) : (
                            (detail?.messages ?? []).map((msg) => {
                              const isOutgoing =
                                msg.senderUserId === user.id ||
                                msg.senderName === user.fullName;
                              return (
                                <div
                                  key={msg._id}
                                  className={`chat-row ${isOutgoing ? "outgoing" : "incoming"}`}
                                  style={{ position: "relative" }}
                                >
                                  {/* Avatar */}
                                  <div className="chat-avatar">
                                    {msg.senderName.charAt(0).toUpperCase()}
                                  </div>

                                  {/* Bubble wrapper */}
                                  <div
                                    style={{
                                      display: "flex",
                                      flexDirection: "column",
                                      alignItems: isOutgoing ? "flex-end" : "flex-start",
                                      maxWidth: "72%",
                                    }}
                                  >
                                    {/* Sender name (incoming only) */}
                                    {!isOutgoing && (
                                      <div className="chat-sender">{msg.senderName}</div>
                                    )}

                                    {/* Sticker — outside bubble */}
                                    {msg.sticker && !msg.message && (
                                      <div className="chat-sticker">{msg.sticker}</div>
                                    )}

                                    {/* Bubble (text or text+sticker or file) */}
                                    {(msg.message || msg.fileData || (msg.sticker && msg.message)) && (
                                      <div className="chat-bubble">
                                        {msg.message && (
                                          <span>{msg.message}</span>
                                        )}
                                        {msg.sticker && msg.message && (
                                          <span style={{ marginLeft: 6, fontSize: 24 }}>
                                            {msg.sticker}
                                          </span>
                                        )}
                                        {msg.fileData && (
                                          <div style={{ marginTop: msg.message ? 8 : 0 }}>
                                            {msg.fileType?.startsWith("image/") ? (
                                              <img
                                                src={msg.fileData}
                                                alt={msg.fileName ?? "attachment"}
                                                style={{
                                                  maxWidth: "100%",
                                                  maxHeight: 160,
                                                  borderRadius: "var(--r-sm)",
                                                  display: "block",
                                                }}
                                              />
                                            ) : (
                                              <a
                                                href={msg.fileData}
                                                download={msg.fileName || "file"}
                                                style={{
                                                  color: isOutgoing ? "rgba(255,255,255,0.9)" : "var(--accent)",
                                                  textDecoration: "underline",
                                                  fontSize: 12,
                                                  display: "flex",
                                                  alignItems: "center",
                                                  gap: 4,
                                                }}
                                              >
                                                📁 {msg.fileName || "tệp_tin"}
                                              </a>
                                            )}
                                          </div>
                                        )}
                                      </div>
                                    )}

                                    {/* Time + pin */}
                                    <div
                                      style={{
                                        display: "flex",
                                        alignItems: "center",
                                        gap: 6,
                                        marginTop: 3,
                                        flexDirection: isOutgoing ? "row-reverse" : "row",
                                      }}
                                    >
                                      <div className="chat-time">
                                        {dayjs(msg.createdAt).format("HH:mm")}
                                        {msg.isPinned && (
                                          <span style={{ marginLeft: 4 }}>📌</span>
                                        )}
                                      </div>
                                      <Button
                                        type="text"
                                        size="small"
                                        onClick={() => void handleTogglePinMessage(msg._id)}
                                        title={msg.isPinned ? "Bỏ ghim" : "Ghim tin nhắn"}
                                        style={{
                                          padding: "0 2px",
                                          height: "auto",
                                          fontSize: 11,
                                          opacity: msg.isPinned ? 1 : 0.35,
                                          color: msg.isPinned
                                            ? "var(--accent-warn)"
                                            : "var(--text-muted)",
                                          transition: "opacity 150ms",
                                        }}
                                      >
                                        {msg.isPinned ? "📌" : "📍"}
                                      </Button>
                                    </div>
                                  </div>
                                </div>
                              );
                            })
                          )}
                          <div ref={messagesEndRef} />
                        </div>

                        {/* Input area */}
                        <div
                          style={{
                            padding: "10px 12px",
                            background: "var(--bg-surface)",
                            borderTop: "1px solid var(--border)",
                            display: "flex",
                            flexDirection: "column",
                            gap: 8,
                          }}
                        >
                          {/* Sticker + file row */}
                          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                            <Popover
                              open={stickerPopoverOpen}
                              onOpenChange={setStickerPopoverOpen}
                              trigger="click"
                              title="Chọn nhãn dán"
                              content={
                                <Space wrap style={{ width: 220 }}>
                                  {STICKERS.map((st) => (
                                    <Button
                                      key={st}
                                      type="text"
                                      onClick={() => {
                                        setStickerPopoverOpen(false);
                                        void handleSendChatMessage(
                                          "",
                                          undefined,
                                          undefined,
                                          undefined,
                                          st,
                                        );
                                      }}
                                      style={{ fontSize: 24, padding: 4, width: 40, height: 40 }}
                                    >
                                      {st}
                                    </Button>
                                  ))}
                                </Space>
                              }
                            >
                              <Button
                                size="small"
                                style={{
                                  background: "var(--bg-surface-2)",
                                  borderColor: "var(--border-strong)",
                                  color: "var(--text-secondary)",
                                }}
                              >
                                😊 Nhãn dán
                              </Button>
                            </Popover>

                            <input
                              type="file"
                              id="detail-file-picker"
                              style={{ display: "none" }}
                              onChange={(e) => {
                                const file = e.target.files?.[0];
                                if (!file) return;
                                const reader = new FileReader();
                                reader.onload = (evt) => {
                                  const base64 = evt.target?.result as string;
                                  void handleSendChatMessage("", base64, file.name, file.type);
                                };
                                reader.readAsDataURL(file);
                                e.target.value = "";
                              }}
                            />
                            <Button
                              size="small"
                              onClick={() =>
                                document.getElementById("detail-file-picker")?.click()
                              }
                              style={{
                                background: "var(--bg-surface-2)",
                                borderColor: "var(--border-strong)",
                                color: "var(--text-secondary)",
                              }}
                            >
                              📎 Đính kèm
                            </Button>
                          </div>

                          {/* Text + Send row */}
                          <div style={{ display: "flex", gap: 8 }}>
                            <Input
                              value={chatText}
                              onChange={(e) => setChatText(e.target.value)}
                              onPressEnter={() => void handleSendChatMessage()}
                              placeholder="Nhập nội dung tin nhắn thảo luận..."
                              disabled={sendingChat}
                              style={{ flex: 1 }}
                            />
                            <Button
                              type="primary"
                              onClick={() => void handleSendChatMessage()}
                              loading={sendingChat}
                            >
                              Gửi
                            </Button>
                          </div>
                        </div>
                      </div>
                    </Col>

                    {/* Recording column */}
                    <Col xs={24} lg={8}>
                      <Typography.Title
                        level={5}
                        style={{ marginBottom: 12, color: "var(--text-primary)" }}
                      >
                        Ghi hình (Recording)
                      </Typography.Title>

                      <div
                        style={{
                          background: "var(--bg-surface-2)",
                          border: "1px solid var(--border)",
                          borderRadius: "var(--r-md)",
                          padding: 16,
                        }}
                      >
                        {!detail?.meeting?.recordingEnabled ? (
                          <Alert
                            type="info"
                            showIcon
                            message="Host chưa kích hoạt recording cho cuộc họp này"
                          />
                        ) : detail.meeting.recordingUrl ? (
                          <Space direction="vertical" style={{ width: "100%" }} size={8}>
                            <Typography.Text
                              strong
                              style={{ fontSize: 12, color: "var(--text-primary)" }}
                            >
                              File ghi hình đã sẵn sàng:
                            </Typography.Text>
                            <video
                              controls
                              style={{
                                width: "100%",
                                borderRadius: "var(--r-sm)",
                                border: "1px solid var(--border)",
                              }}
                              src={detail.meeting.recordingUrl}
                            />
                            <a
                              href={detail.meeting.recordingUrl}
                              target="_blank"
                              rel="noreferrer"
                              style={{
                                fontSize: 12,
                                display: "block",
                                marginTop: 4,
                                color: "var(--accent)",
                              }}
                            >
                              📥 Tải video ghi hình về thiết bị
                            </a>
                          </Space>
                        ) : (
                          <Alert
                            type="warning"
                            showIcon
                            message="Tính năng recording đang bật nhưng chưa có file lưu trữ"
                          />
                        )}
                      </div>
                    </Col>
                  </Row>
                </div>
              ),
            },
          ]}
        />
      </Card>

      {/* Edit Modal */}
      <Modal
        title="Chỉnh sửa thông tin cuộc họp"
        open={editOpen}
        confirmLoading={updating}
        onOk={() => void handleSaveEdit()}
        onCancel={() => setEditOpen(false)}
        okText="Lưu thay đổi"
        cancelText="Hủy"
        width={560}
      >
        <Form form={editForm} layout="vertical" style={{ marginTop: 16 }}>
          <Form.Item
            name="title"
            label="Tiêu đề cuộc họp"
            rules={[{ required: true, message: "Vui lòng nhập tiêu đề" }]}
          >
            <Input placeholder="Sprint planning..." />
          </Form.Item>
          <Form.Item name="description" label="Mô tả">
            <Input.TextArea rows={3} placeholder="Nội dung / Agenda..." />
          </Form.Item>
          <Form.Item
            name="category"
            label="Loại cuộc họp"
            rules={[{ required: true, message: "Vui lòng chọn loại" }]}
          >
            <Select
              options={[
                { value: "personal", label: "Cá nhân (Personal)" },
                { value: "interview", label: "Phỏng vấn (Interview)" },
                { value: "team_meeting", label: "Team Meeting" },
                { value: "client_meeting", label: "Khách hàng (Client)" },
                { value: "training", label: "Đào tạo (Training)" },
              ]}
            />
          </Form.Item>
          <Form.Item
            name="startTime"
            label="Thời gian bắt đầu"
            rules={[{ required: true, message: "Vui lòng chọn thời gian bắt đầu" }]}
          >
            <DatePicker showTime style={{ width: "100%" }} format="DD/MM/YYYY HH:mm" />
          </Form.Item>
          <Form.Item
            name="duration"
            label="Thời lượng cuộc họp"
          >
            <Select
              placeholder="Vô hạn (Đến khi Host kết thúc)"
              allowClear
              options={[
                { value: 15, label: "15 phút" },
                { value: 30, label: "30 phút" },
                { value: 45, label: "45 phút" },
                { value: 60, label: "1 giờ" },
                { value: 90, label: "1.5 giờ" },
                { value: 120, label: "2 giờ" },
                { value: 180, label: "3 giờ" },
                { value: "infinite", label: "Vô hạn (Đến khi Host kết thúc)" },
              ]}
            />
          </Form.Item>
          <Form.Item
            name="privacyMode"
            label="Quyền truy cập"
            rules={[{ required: true, message: "Vui lòng chọn quyền truy cập" }]}
          >
            <Select
              options={[
                { value: "private", label: "🔒 Riêng tư (Private)" },
                { value: "public", label: "🌐 Công khai (Public)" },
              ]}
            />
          </Form.Item>
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item name="waitingRoomEnabled" label="Bật phòng chờ" valuePropName="checked">
                <Switch />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item
                name="recordingEnabled"
                label="Tự động ghi hình"
                valuePropName="checked"
              >
                <Switch />
              </Form.Item>
            </Col>
          </Row>
        </Form>
      </Modal>
    </Space>
  );
};
