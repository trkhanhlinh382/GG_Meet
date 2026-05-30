import { ArrowLeftOutlined, EditOutlined, TeamOutlined, CommentOutlined, InfoCircleOutlined } from "@ant-design/icons";
import { Alert, Button, Card, Descriptions, Form, Input, Space, Tag, Typography, message, Modal, DatePicker, Select, Switch, Tabs, Row, Col, Avatar, Popover } from "antd";
import type { AxiosError } from "axios";
import dayjs from "dayjs";
import { useEffect, useMemo, useState, useRef } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { http } from "../api/http";
import type { MeetingDetailsPayload } from "../api/types";

interface SessionUser {
  id: string;
  fullName: string;
  email: string;
}

interface MeetingDetailPageProps {
  token: string;
  user: SessionUser;
}

export const MeetingDetailPage = ({ token, user }: MeetingDetailPageProps) => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [detail, setDetail] = useState<MeetingDetailsPayload>();
  const [loading, setLoading] = useState(false);
  const [inviting, setInviting] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [updating, setUpdating] = useState(false);
  const [chatText, setChatText] = useState("");
  const [sendingChat, setSendingChat] = useState(false);
  const [form] = Form.useForm();
  const [editForm] = Form.useForm();

  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [detail?.messages]);

  useEffect(() => {
    if (!id) {
      return;
    }

    setLoading(true);
    http
      .get<MeetingDetailsPayload>(`/meetings/${id}/details`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      })
      .then((response) => setDetail(response.data))
      .catch(() => message.error("Không tải được chi tiết cuộc họp"))
      .finally(() => setLoading(false));
  }, [id, token]);

  const status = useMemo(() => {
    if (!detail?.meeting) {
      return "unknown" as const;
    }

    const now = Date.now();
    const start = new Date(detail.meeting.startTime).getTime();
    const end = new Date(detail.meeting.endTime).getTime();

    if (detail.meeting.status === "ended" || detail.meeting.status === "cancelled" || end < now) {
      return "ended" as const;
    }

    if (start > now) {
      return "upcoming" as const;
    }

    return "ongoing" as const;
  }, [detail?.meeting]);

  const statusTag =
    status === "ended" ? (
      <Tag color="default">Cuộc họp đã kết thúc</Tag>
    ) : status === "upcoming" ? (
      <Tag color="blue">Sắp diễn ra</Tag>
    ) : (
      <Button
        type="primary"
        size="small"
        style={{ background: "#52c41a", borderColor: "#52c41a", borderRadius: 4 }}
        onClick={() => navigate(`/room/${id}`)}
      >
        Đang diễn ra (Vào họp)
      </Button>
    );

  const ownerIdStr = useMemo(() => {
    if (!detail?.meeting?.ownerId) return "";
    if (typeof detail.meeting.ownerId === "object") {
      return (detail.meeting.ownerId as any)._id || (detail.meeting.ownerId as any).id || "";
    }
    return detail.meeting.ownerId;
  }, [detail?.meeting?.ownerId]);

  const isOwner = useMemo(() => ownerIdStr === user.id, [ownerIdStr, user.id]);
  const canInvite = useMemo(() => (status === "upcoming" || status === "ongoing") && isOwner, [status, isOwner]);

  const handleInvite = async () => {
    if (!id) {
      return;
    }

    const values = await form.validateFields();
    setInviting(true);

    try {
      await http.post(
        `/meetings/${id}/invite`,
        {
          participantEmails: [values.email],
        },
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        },
      );
      message.success("Đã gửi lời mời");
      form.resetFields();
      
      // Reload details to show the new invitation
      const response = await http.get<MeetingDetailsPayload>(`/meetings/${id}/details`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });
      setDetail(response.data);
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

  const handleOpenEdit = () => {
    if (!detail?.meeting) return;
    editForm.setFieldsValue({
      title: detail.meeting.title,
      description: detail.meeting.description,
      category: detail.meeting.category,
      timeRange: [dayjs(detail.meeting.startTime), dayjs(detail.meeting.endTime)],
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
      const [start, end] = values.timeRange as [dayjs.Dayjs, dayjs.Dayjs];

      setUpdating(true);
      await http.put(
        `/meetings/${id}`,
        {
          title: values.title,
          description: values.description,
          category: values.category,
          startTime: start.toISOString(),
          endTime: end.toISOString(),
          privacyMode: values.privacyMode,
          waitingRoomEnabled: values.waitingRoomEnabled,
          recordingEnabled: values.recordingEnabled,
        },
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        },
      );

      message.success("Cập nhật thông tin cuộc họp thành công");
      setEditOpen(false);

      // Reload detail page
      setLoading(true);
      const response = await http.get<MeetingDetailsPayload>(`/meetings/${id}/details`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });
      setDetail(response.data);
    } catch (error) {
      const axiosError = error as AxiosError<{ message?: string }>;
      message.error(axiosError.response?.data?.message ?? "Không thể cập nhật cuộc họp");
    } finally {
      setLoading(false);
      setUpdating(false);
    }
  };

  const handleEndMeeting = async () => {
    if (!id) return;
    try {
      setLoading(true);
      await http.post(`/meetings/${id}/end`, {}, {
        headers: { Authorization: `Bearer ${token}` }
      });
      message.success("Đã kết thúc cuộc họp");
      const response = await http.get<MeetingDetailsPayload>(`/meetings/${id}/details`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setDetail(response.data);
    } catch {
      message.error("Không thể kết thúc cuộc họp");
    } finally {
      setLoading(false);
    }
  };

  const handleReopenMeeting = async () => {
    if (!id) return;
    try {
      setLoading(true);
      await http.post(`/meetings/${id}/reopen`, {}, {
        headers: { Authorization: `Bearer ${token}` }
      });
      message.success("Đã mở lại cuộc họp thành công");
      const response = await http.get<MeetingDetailsPayload>(`/meetings/${id}/details`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setDetail(response.data);
    } catch {
      message.error("Không thể mở lại cuộc họp");
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteMeeting = async () => {
    if (!id) return;
    try {
      setLoading(true);
      await http.delete(`/meetings/${id}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      message.success("Xóa cuộc họp thành công");
      navigate("/meetings");
    } catch {
      message.error("Không thể xóa cuộc họp");
      setLoading(false);
    }
  };

  const confirmDeleteMeeting = () => {
    Modal.confirm({
      title: "Xác nhận xóa cuộc họp?",
      content: "Hành động này sẽ xóa vĩnh viễn cuộc họp và các lời mời liên quan. Bạn không thể hoàn tác.",
      okText: "Xóa",
      okType: "danger",
      cancelText: "Hủy",
      onOk: () => void handleDeleteMeeting(),
    });
  };

  const handleKickUser = async (targetUserId: string) => {
    if (!id) return;
    try {
      await http.delete(`/meetings/${id}/kick/${targetUserId}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      message.success("Đã xóa thành viên khỏi cuộc họp");
      const response = await http.get<MeetingDetailsPayload>(`/meetings/${id}/details`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setDetail(response.data);
    } catch {
      message.error("Không thể kick thành viên");
    }
  };

  const confirmKickUser = (targetUserId: string, userName: string) => {
    Modal.confirm({
      title: "Xác nhận kick thành viên?",
      content: `Bạn có chắc chắn muốn kick ${userName} khỏi cuộc họp này?`,
      okText: "Kick",
      okType: "danger",
      cancelText: "Hủy",
      onOk: () => void handleKickUser(targetUserId),
    });
  };

  const handleSendChatMessage = async (
    customText?: string,
    fileData?: string,
    fileName?: string,
    fileType?: string,
    sticker?: string
  ) => {
    if (!id) return;
    const textToSend = customText !== undefined ? customText : chatText;
    if (!textToSend.trim() && !fileData && !sticker) return;

    setSendingChat(true);
    try {
      await http.post(
        `/meetings/${id}/messages`,
        {
          message: textToSend,
          fileData,
          fileName,
          fileType,
          sticker,
        },
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        },
      );
      if (customText === undefined) {
        setChatText("");
      }
      
      // Reload details to show the new message
      const response = await http.get<MeetingDetailsPayload>(`/meetings/${id}/details`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });
      setDetail(response.data);
    } catch (err: any) {
      const serverMsg = err?.response?.data?.message;
      message.error(serverMsg || "Không gửi được tin nhắn");
    } finally {
      setSendingChat(false);
    }
  };

  const handleTogglePinMessage = async (messageId: string) => {
    if (!id) return;
    try {
      await http.patch(
        `/meetings/${id}/messages/${messageId}/pin`,
        {},
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        },
      );
      
      // Reload details to show the updated pinned state
      const response = await http.get<MeetingDetailsPayload>(`/meetings/${id}/details`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });
      setDetail(response.data);
      message.success("Cập nhật ghim tin nhắn thành công");
    } catch {
      message.error("Không thể ghim/bỏ ghim tin nhắn");
    }
  };

  const pinnedMessages = useMemo(() => {
    return (detail?.messages ?? []).filter((msg) => msg.isPinned);
  }, [detail?.messages]);

  return (
    <Space direction="vertical" size={16} style={{ width: "100%" }}>
      <Space style={{ width: "100%", justifyContent: "space-between" }}>
        <Space>
          <Button icon={<ArrowLeftOutlined />} onClick={() => navigate("/meetings")}>
            Back
          </Button>
          <Typography.Title level={4} style={{ margin: 0 }}>
            Meeting Detail
          </Typography.Title>
        </Space>
        {isOwner && (status === "upcoming" || status === "ongoing") && (
          <Button type="primary" icon={<EditOutlined />} onClick={handleOpenEdit}>
            Chỉnh sửa
          </Button>
        )}
      </Space>

      <Card loading={loading} bodyStyle={{ padding: 20 }} style={{ borderRadius: 12, border: "1px solid rgba(0,0,0,0.06)", boxShadow: "0 4px 12px rgba(0,0,0,0.02)" }}>
        <Tabs
          defaultActiveKey="overview"
          items={[
            {
              key: "overview",
              label: (
                <span>
                  <InfoCircleOutlined />
                  Tổng quát
                </span>
              ),
              children: (
                <div style={{ marginTop: 8 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 12, marginBottom: 20 }}>
                    <Typography.Title level={4} style={{ margin: 0, color: "#1f2937" }}>
                      {detail?.meeting?.title ?? "Chi tiết cuộc họp"}
                    </Typography.Title>
                    <Space wrap size={8}>
                      {statusTag}
                      {isOwner && status === "ongoing" && (
                        <Button
                          danger
                          type="primary"
                          onClick={() => void handleEndMeeting()}
                          style={{ borderRadius: 6 }}
                        >
                          Kết thúc cuộc họp
                        </Button>
                      )}
                      {isOwner && status === "ended" && (
                        <Button
                          type="primary"
                          onClick={() => void handleReopenMeeting()}
                          style={{ borderRadius: 6, background: "#52c41a", borderColor: "#52c41a" }}
                        >
                          Mở lại cuộc họp
                        </Button>
                      )}
                      {isOwner && (
                        <Button
                          danger
                          onClick={confirmDeleteMeeting}
                          style={{ borderRadius: 6 }}
                        >
                          Xóa cuộc họp
                        </Button>
                      )}
                    </Space>
                  </div>

                  {detail?.meeting ? (
                    <Descriptions bordered size="middle" column={1} labelStyle={{ fontWeight: 500, width: 180, background: "#f9fafb" }}>
                      <Descriptions.Item label="Thể loại cuộc họp">
                        <Tag style={{ borderRadius: 4, padding: "2px 8px" }}>
                          {detail.meeting.category === "personal" ? "Cá nhân" :
                           detail.meeting.category === "interview" ? "Phỏng vấn" :
                           detail.meeting.category === "team_meeting" ? "Team Meeting" :
                           detail.meeting.category === "client_meeting" ? "Khách hàng" : "Đào tạo"}
                        </Tag>
                      </Descriptions.Item>
                      <Descriptions.Item label="Quyền truy cập">
                        <Tag color={detail.meeting.privacyMode === "private" ? "red" : "blue"} style={{ borderRadius: 4, padding: "2px 8px" }}>
                          {detail.meeting.privacyMode === "private" ? "Riêng tư (Private)" : "Công khai (Public)"}
                        </Tag>
                      </Descriptions.Item>
                      <Descriptions.Item label="Thời gian bắt đầu">
                        {dayjs(detail.meeting.startTime).format("DD/MM/YYYY HH:mm")}
                      </Descriptions.Item>
                      <Descriptions.Item label="Thời gian kết thúc">
                        {dayjs(detail.meeting.endTime).format("DD/MM/YYYY HH:mm")}
                      </Descriptions.Item>
                      <Descriptions.Item label="Nội dung cuộc họp">
                        <div style={{ whiteSpace: "pre-wrap", color: "#4b5563" }}>
                          {detail.meeting.description?.trim() || "Chưa có nội dung mô tả cuộc họp."}
                        </div>
                      </Descriptions.Item>
                    </Descriptions>
                  ) : null}
                </div>
              ),
            },
            {
              key: "members",
              label: (
                <span>
                  <TeamOutlined />
                  Thành viên ({ (detail?.invitations?.length ?? 0) + 1 })
                </span>
              ),
              children: (
                <div style={{ marginTop: 8 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 12, marginBottom: 16 }}>
                    <Typography.Title level={5} style={{ margin: 0, color: "#374151" }}>
                      Danh sách người tham gia
                    </Typography.Title>
                    {canInvite && (
                      <Form layout="inline" form={form} style={{ display: "inline-flex", gap: 8, alignItems: "center" }}>
                        <Form.Item name="email" rules={[{ required: true, message: "Nhập email" }, { type: "email", message: "Email không hợp lệ" }] } style={{ marginBottom: 0 }}>
                          <Input placeholder="Mời thành viên qua email..." size="middle" style={{ width: 220, borderRadius: 6 }} />
                        </Form.Item>
                        <Button type="primary" loading={inviting} onClick={() => void handleInvite()} style={{ borderRadius: 6, background: "#0d5f4f", borderColor: "#0d5f4f" }}>
                          Mời
                        </Button>
                      </Form>
                    )}
                  </div>
                  
                  <Row gutter={[12, 12]}>
                    {/* Host Card */}
                    {detail?.meeting && (
                      <Col xs={24} sm={12} md={8} lg={6}>
                        <Card
                          size="small"
                          style={{ borderRadius: 10, border: "1px solid #ffe58f", background: "#fffbe6" }}
                          bodyStyle={{ padding: 12 }}
                        >
                          <div style={{ display: "flex", gap: 12, alignItems: "flex-start" }}>
                            <Avatar style={{ background: "#fadb14", color: "#000", flexShrink: 0 }}>👑</Avatar>
                            <div style={{ flex: 1, minWidth: 0 }}>
                              <Typography.Text strong style={{ display: "block", fontSize: 13, color: "#1f2937" }}>
                                {typeof detail.meeting.ownerId === "object" ? (detail.meeting.ownerId as any).fullName : "Host"}
                              </Typography.Text>
                              <Typography.Text type="secondary" style={{ fontSize: 11, display: "block" }} ellipsis={{ tooltip: typeof detail.meeting.ownerId === "object" ? (detail.meeting.ownerId as any).email : "" }}>
                                {typeof detail.meeting.ownerId === "object" ? (detail.meeting.ownerId as any).email : "Chủ cuộc họp"}
                              </Typography.Text>
                              <Tag color="gold" style={{ fontSize: 10, marginTop: 4, borderRadius: 4 }}>Chủ phòng (Host)</Tag>
                            </div>
                          </div>
                        </Card>
                      </Col>
                    )}

                    {/* Invited Members Cards */}
                    {(detail?.invitations ?? []).map((item) => {
                      const invitedUser = typeof item.userId === "object" ? item.userId : null;
                      const color = item.status === "accepted" ? "green" : item.status === "rejected" ? "red" : item.status === "maybe" ? "blue" : "orange";
                      const statusLabel = item.status === "accepted" ? "Đã đồng ý (accept)" : item.status === "rejected" ? "Từ chối" : item.status === "maybe" ? "Có thể" : "Chưa phản hồi (chưa)";

                      return (
                        <Col xs={24} sm={12} md={8} lg={6} key={item._id}>
                          <Card
                            size="small"
                            style={{ borderRadius: 10, border: "1px solid rgba(0,0,0,0.06)" }}
                            bodyStyle={{ padding: 12 }}
                          >
                            <div style={{ display: "flex", gap: 12, alignItems: "flex-start" }}>
                              <Avatar style={{ background: "#1677ff", flexShrink: 0 }}>{(invitedUser?.fullName ?? "U").charAt(0)}</Avatar>
                              <div style={{ flex: 1, minWidth: 0 }}>
                                <Typography.Text strong style={{ display: "block", fontSize: 13, color: "#1f2937" }}>
                                  {invitedUser?.fullName ?? "Người dùng"}
                                </Typography.Text>
                                <Typography.Text type="secondary" style={{ fontSize: 11, display: "block" }} ellipsis={{ tooltip: invitedUser?.email }}>
                                  {invitedUser?.email ?? "Không có email"}
                                </Typography.Text>
                                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", width: "100%", marginTop: 8 }}>
                                  <Space size={4}>
                                    <Tag color="cyan" style={{ fontSize: 10, borderRadius: 4 }}>Được mời</Tag>
                                    <Tag color={color} style={{ fontSize: 10, borderRadius: 4 }}>{statusLabel}</Tag>
                                  </Space>
                                  {isOwner && invitedUser && (
                                    <Button
                                      danger
                                      type="text"
                                      size="small"
                                      onClick={() => confirmKickUser(invitedUser._id, invitedUser.fullName)}
                                      style={{ padding: "0 4px", fontSize: 11 }}
                                    >
                                      Kick
                                    </Button>
                                  )}
                                </div>
                              </div>
                            </div>
                          </Card>
                        </Col>
                      );
                    })}

                    {/* Waiting requests Cards (Only visible to host) */}
                    {isOwner && (detail?.waitingRequests ?? []).map((item) => (
                      <Col xs={24} sm={12} md={8} lg={6} key={item.socketId}>
                        <Card
                          size="small"
                          style={{ borderRadius: 10, border: "1px solid #ff4d4f", background: "#fff2f0" }}
                          bodyStyle={{ padding: 12 }}
                        >
                          <Space align="start" size={10} direction="vertical" style={{ width: "100%" }}>
                            <Space align="start" size={10}>
                              <Avatar style={{ background: "#ff4d4f" }}>⏳</Avatar>
                              <div>
                                <Typography.Text strong style={{ display: "block", fontSize: 13, color: "#1f2937" }}>
                                  {item.name}
                                </Typography.Text>
                                <Typography.Text type="secondary" style={{ fontSize: 11, display: "block" }}>
                                  Đang ở phòng chờ
                                </Typography.Text>
                              </div>
                            </Space>
                            <Tag color="error" style={{ fontSize: 10, borderRadius: 4 }}>Yêu cầu vào họp</Tag>
                          </Space>
                        </Card>
                      </Col>
                    ))}
                  </Row>

                  {isOwner && (detail?.waitingRequests ?? []).length > 0 && (
                    <Alert
                      type="warning"
                      showIcon
                      message="Có người tham gia đang đợi duyệt"
                      description="Vui lòng nhấn nút 'Đang diễn ra (Vào họp)' ở tab Tổng quát để truy cập vào phòng họp và tiến hành duyệt quyền vào phòng trực tiếp."
                      style={{ marginTop: 16, borderRadius: 8 }}
                    />
                  )}
                </div>
              ),
            },
            {
              key: "chat",
              label: (
                <span>
                  <CommentOutlined />
                  Tin nhắn cuộc họp
                </span>
              ),
              children: (
                <div style={{ marginTop: 8 }}>
                  <Row gutter={[16, 16]}>
                    <Col xs={24} lg={16}>
                      <Typography.Title level={5} style={{ marginBottom: 12, color: "#374151" }}>
                        Kênh thảo luận trước cuộc họp
                      </Typography.Title>
                      
                      <div style={{
                        display: "flex",
                        flexDirection: "column",
                        height: 520,
                        border: "1px solid rgba(0,0,0,0.08)",
                        borderRadius: 12,
                        background: "#f9fafb",
                        overflow: "hidden"
                      }}>
                        {/* Pinned Messages Banner */}
                        {pinnedMessages.length > 0 && (
                          <div style={{
                            padding: "8px 16px",
                            background: "#fffbe6",
                            borderBottom: "1px solid #ffe58f",
                            display: "flex",
                            flexDirection: "column",
                            gap: 4,
                            maxHeight: 100,
                            overflowY: "auto"
                          }}>
                            <div style={{ display: "flex", alignItems: "center", gap: 6, color: "#d48806", fontWeight: "bold", fontSize: 12 }}>
                              📌 TIN NHẮN ĐÃ GHIM ({pinnedMessages.length})
                            </div>
                            {pinnedMessages.map((pm) => (
                              <div key={pm._id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: 12, color: "#595959" }}>
                                <div style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", flex: 1, marginRight: 8 }}>
                                  <strong>{pm.senderName}:</strong> {pm.message || (pm.sticker ? `[Nhãn dán ${pm.sticker}]` : "📁 [Tệp đính kèm]")}
                                </div>
                                <Button
                                  type="text"
                                  size="small"
                                  onClick={() => void handleTogglePinMessage(pm._id)}
                                  style={{ padding: "0 4px", height: "auto", fontSize: 11, color: "#ff4d4f" }}
                                >
                                  Bỏ ghim
                                </Button>
                              </div>
                            ))}
                          </div>
                        )}

                        {/* Chat Messages Logs */}
                        <div style={{
                          flex: 1,
                          padding: "16px 20px",
                          overflowY: "auto",
                          display: "flex",
                          flexDirection: "column",
                          gap: 12
                        }}>
                          {(detail?.messages ?? []).length === 0 ? (
                            <div style={{ display: "flex", flex: 1, alignItems: "center", justifyContent: "center", color: "#9ca3af", fontSize: 13 }}>
                              Chưa có cuộc thảo luận nào. Hãy soạn tin nhắn đầu tiên!
                            </div>
                          ) : (
                            (detail?.messages ?? []).map((msg, index) => {
                              const isOutgoing = msg.senderUserId === user.id || msg.senderName === user.fullName;
                              return (
                                <div
                                  key={index}
                                  style={{
                                    display: "flex",
                                    justifyContent: isOutgoing ? "flex-end" : "flex-start",
                                    width: "100%",
                                    alignItems: "center",
                                    gap: 8
                                  }}
                                >
                                  {isOutgoing && (
                                    <Button
                                      type="text"
                                      shape="circle"
                                      size="small"
                                      onClick={() => void handleTogglePinMessage(msg._id)}
                                      icon={<span>{msg.isPinned ? "📌" : "📍"}</span>}
                                      style={{ color: msg.isPinned ? "#d48806" : "#bfbfbf", opacity: msg.isPinned ? 1 : 0.4 }}
                                      title={msg.isPinned ? "Bỏ ghim tin nhắn" : "Ghim tin nhắn"}
                                    />
                                  )}

                                  <div style={{
                                    display: "flex",
                                    flexDirection: "column",
                                    alignItems: isOutgoing ? "flex-end" : "flex-start",
                                    maxWidth: "70%"
                                  }}>
                                    {!isOutgoing && (
                                      <span style={{ fontSize: 11, color: "#6b7280", marginBottom: 2, marginLeft: 4 }}>
                                        {msg.senderName}
                                      </span>
                                    )}
                                    <div style={{
                                      padding: "8px 14px",
                                      borderRadius: 14,
                                      borderTopRightRadius: isOutgoing ? 2 : 14,
                                      borderTopLeftRadius: isOutgoing ? 14 : 2,
                                      background: isOutgoing ? "#1677ff" : "#ffffff",
                                      color: isOutgoing ? "#ffffff" : "#1f2937",
                                      boxShadow: "0 2px 6px rgba(0,0,0,0.04)",
                                      fontSize: 13,
                                      lineHeight: "18px",
                                      wordBreak: "break-word"
                                    }}>
                                      {msg.message}

                                      {msg.fileData && (
                                        <div style={{ marginTop: 6 }}>
                                          {msg.fileType?.startsWith("image/") ? (
                                            <img
                                              src={msg.fileData}
                                              alt={msg.fileName ?? "attachment"}
                                              style={{ maxWidth: "100%", maxHeight: 150, borderRadius: 8, marginTop: 4 }}
                                            />
                                          ) : (
                                            <a href={msg.fileData} download={msg.fileName || "file"} style={{ color: isOutgoing ? "#e6f7ff" : "#1677ff", textDecoration: "underline", fontSize: 12, display: "flex", alignItems: "center", gap: 4 }}>
                                              📁 Tải về: {msg.fileName || "tệp_tin"}
                                            </a>
                                          )}
                                        </div>
                                      )}

                                      {msg.sticker && (
                                        <div style={{ fontSize: 40, marginTop: 4 }}>
                                          {msg.sticker}
                                        </div>
                                      )}
                                    </div>
                                    <span style={{ fontSize: 10, color: "#9ca3af", marginTop: 2, marginLeft: 4, marginRight: 4 }}>
                                      {dayjs(msg.createdAt).format("HH:mm, DD/MM")}
                                    </span>
                                  </div>

                                  {!isOutgoing && (
                                    <Button
                                      type="text"
                                      shape="circle"
                                      size="small"
                                      onClick={() => void handleTogglePinMessage(msg._id)}
                                      icon={<span>{msg.isPinned ? "📌" : "📍"}</span>}
                                      style={{ color: msg.isPinned ? "#d48806" : "#bfbfbf", opacity: msg.isPinned ? 1 : 0.4 }}
                                      title={msg.isPinned ? "Bỏ ghim tin nhắn" : "Ghim tin nhắn"}
                                    />
                                  )}
                                </div>
                              );
                            })
                          )}
                          <div ref={messagesEndRef} />
                        </div>

                        {/* Input Area */}
                        <div style={{
                          padding: 12,
                          background: "#ffffff",
                          borderTop: "1px solid rgba(0,0,0,0.08)",
                          display: "flex",
                          flexDirection: "column",
                          gap: 8
                        }}>
                          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                            <Popover
                              content={
                                <Space wrap style={{ width: 220 }}>
                                  {["🐱", "🐶", "🚀", "🎉", "👍", "❤️", "😂", "😮", "🔥", "💯", "👏", "💩"].map((st) => (
                                    <Button
                                      key={st}
                                      type="text"
                                      onClick={() => void handleSendChatMessage("", undefined, undefined, undefined, st)}
                                      style={{ fontSize: 24, padding: 4, width: 40, height: 40 }}
                                    >
                                      {st}
                                    </Button>
                                  ))}
                                </Space>
                              }
                              title="Chọn Nhãn Dán"
                              trigger="click"
                            >
                              <Button size="small" icon={<span>😊</span>} style={{ borderRadius: 6 }}>Nhãn dán</Button>
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
                              icon={<span>📎</span>}
                              onClick={() => document.getElementById("detail-file-picker")?.click()}
                              style={{ borderRadius: 6 }}
                            >
                              Đính kèm File
                            </Button>
                          </div>

                          <div style={{ display: "flex", gap: 8 }}>
                            <Input
                              value={chatText}
                              onChange={(e) => setChatText(e.target.value)}
                              onPressEnter={() => void handleSendChatMessage()}
                              placeholder="Nhập nội dung tin nhắn thảo luận..."
                              style={{ borderRadius: 8 }}
                              disabled={sendingChat}
                            />
                            <Button
                              type="primary"
                              onClick={() => void handleSendChatMessage()}
                              loading={sendingChat}
                              style={{ borderRadius: 8 }}
                            >
                              Gửi
                            </Button>
                          </div>
                        </div>
                      </div>
                    </Col>
                    
                    <Col xs={24} lg={8}>
                      <Typography.Title level={5} style={{ marginBottom: 12, color: "#374151" }}>
                        Ghi hình (Recording)
                      </Typography.Title>
                      
                      <Card style={{ borderRadius: 12, border: "1px solid rgba(0,0,0,0.06)", background: "#fafafa" }} bodyStyle={{ padding: 16 }}>
                        {!detail?.meeting?.recordingEnabled ? (
                          <Alert type="info" showIcon message="Host chưa kích hoạt recording cho cuộc họp này" />
                        ) : detail.meeting.recordingUrl ? (
                          <Space direction="vertical" style={{ width: "100%" }} size={8}>
                            <Typography.Text strong style={{ fontSize: 12 }}>File ghi hình đã sẵn sàng:</Typography.Text>
                            <video controls style={{ width: "100%", borderRadius: 8, border: "1px solid rgba(0,0,0,0.08)" }} src={detail.meeting.recordingUrl} />
                            <a href={detail.meeting.recordingUrl} target="_blank" rel="noreferrer" style={{ fontSize: 12, display: "block", marginTop: 4 }}>
                              Tải video ghi hình về thiết bị
                            </a>
                          </Space>
                        ) : (
                          <Alert type="warning" showIcon message="Tính năng recording đang bật nhưng chưa có file lưu trữ" />
                        )}
                      </Card>
                    </Col>
                  </Row>
                </div>
              ),
            },
          ]}
        />
      </Card>

      <Modal
        title="Chỉnh sửa thông tin cuộc họp"
        open={editOpen}
        confirmLoading={updating}
        onOk={() => void handleSaveEdit()}
        onCancel={() => setEditOpen(false)}
        okText="Lưu"
        cancelText="Hủy"
      >
        <Form form={editForm} layout="vertical">
          <Form.Item name="title" label="Tiêu đề cuộc họp" rules={[{ required: true, message: "Vui lòng nhập tiêu đề" }]}>
            <Input placeholder="Sprint planning..." />
          </Form.Item>
          <Form.Item name="description" label="Mô tả">
            <Input.TextArea rows={2} placeholder="Nội dung/Agenda..." />
          </Form.Item>
          <Form.Item name="category" label="Loại cuộc họp" rules={[{ required: true }]}>
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
          <Form.Item name="timeRange" label="Thời gian diễn ra" rules={[{ required: true, message: "Vui lòng chọn thời gian" }]}>
            <DatePicker.RangePicker showTime style={{ width: "100%" }} />
          </Form.Item>
          <Form.Item name="privacyMode" label="Quyền truy cập" rules={[{ required: true }]}>
            <Select options={[{ value: "private", label: "Riêng tư (Private)" }, { value: "public", label: "Công khai (Public)" }]} />
          </Form.Item>
          <Form.Item name="waitingRoomEnabled" label="Bật phòng chờ" valuePropName="checked">
            <Switch />
          </Form.Item>
          <Form.Item name="recordingEnabled" label="Tự động ghi hình (Recording)" valuePropName="checked">
            <Switch />
          </Form.Item>
        </Form>
      </Modal>
    </Space>
  );
};
