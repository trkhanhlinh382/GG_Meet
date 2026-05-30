import { CalendarOutlined, MailOutlined, PlusCircleOutlined, VideoCameraOutlined } from "@ant-design/icons";
import { Badge, Button, Card, Col, DatePicker, Form, Input, List, Modal, Row, Select, Space, Switch, Tag, message, Typography } from "antd";
import type { Dayjs } from "dayjs";
import dayjs from "dayjs";
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import type { DashboardPayload, InvitationWithMeeting } from "../api/types";

interface MeetingsPageProps {
  data?: DashboardPayload;
  onCreateMeeting: (input: {
    title: string;
    description?: string;
    category: "personal" | "interview" | "team_meeting" | "client_meeting" | "training";
    startTime: string;
    endTime: string;
    privacyMode: "public" | "private";
    waitingRoomEnabled: boolean;
    isRecurring?: boolean;
    recurrence?: {
      frequency: "daily" | "weekly" | "monthly" | "none";
      endDate?: string;
    };
    isInstant?: boolean;
  }) => Promise<void>;
  onJoinMeeting: (rawLink: string) => Promise<void>;
}

export const MeetingsPage = ({ data, onCreateMeeting, onJoinMeeting }: MeetingsPageProps) => {
  const navigate = useNavigate();
  const [createOpen, setCreateOpen] = useState(false);
  const [joinOpen, setJoinOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const [creatingInstant, setCreatingInstant] = useState(false);
  const [showRecurrenceForm, setShowRecurrenceForm] = useState(false);
  const [joining, setJoining] = useState(false);
  const [createForm] = Form.useForm();
  const [joinForm] = Form.useForm();

  const getHostLabel = (ownerId: DashboardPayload["upcomingMeetings"][number]["ownerId"]) => {
    if (ownerId && typeof ownerId === "object") {
      return ownerId.fullName;
    }

    return "Không rõ host";
  };

  const handleCreateMeeting = async () => {
    try {
      const values = await createForm.validateFields();
      const [start, end] = values.timeRange as [Dayjs, Dayjs];

      if (start.isBefore(dayjs())) {
        message.warning("Thời gian bắt đầu phải ở tương lai");
        return;
      }

      if (!end.isAfter(start)) {
        message.warning("Thời gian kết thúc phải sau thời gian bắt đầu");
        return;
      }

      setCreating(true);
      await onCreateMeeting({
        title: values.title,
        description: values.description,
        category: values.category,
        startTime: start.toISOString(),
        endTime: end.toISOString(),
        privacyMode: values.privacyMode,
        waitingRoomEnabled: values.waitingRoomEnabled,
        isRecurring: values.isRecurring,
        recurrence: values.isRecurring && values.recurrence
          ? {
              frequency: values.recurrence.frequency,
              endDate: values.recurrence.endDate.toISOString(),
            }
          : undefined,
      });

      setCreateOpen(false);
      createForm.resetFields();
      setShowRecurrenceForm(false);
    } finally {
      setCreating(false);
    }
  };

  const handleCreateInstantMeeting = async () => {
    setCreatingInstant(true);
    try {
      await onCreateMeeting({
        title: "Cuộc họp tức thì",
        description: "Cuộc họp tức thì tạo nhanh, kết thúc khi host dừng họp.",
        category: "team_meeting",
        startTime: new Date().toISOString(),
        endTime: new Date("2099-12-31T23:59:59.999Z").toISOString(),
        privacyMode: "public",
        waitingRoomEnabled: false,
        isInstant: true,
      });
    } catch {
      message.error("Không thể tạo cuộc họp tức thì");
    } finally {
      setCreatingInstant(false);
    }
  };

  const handleJoinByLink = async () => {
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

  return (
    <Space direction="vertical" size={16} style={{ width: "100%" }}>
      <Card style={{ borderRadius: 12, border: "1px solid rgba(0,0,0,0.06)", boxShadow: "0 4px 12px rgba(0,0,0,0.02)" }}>
        <Space wrap>
          <Button
            type="primary"
            icon={<VideoCameraOutlined />}
            onClick={() => void handleCreateInstantMeeting()}
            loading={creatingInstant}
            style={{ borderRadius: 6, background: "#52c41a", borderColor: "#52c41a" }}
          >
            Họp ngay
          </Button>
          <Button type="primary" icon={<PlusCircleOutlined />} onClick={() => setCreateOpen(true)} style={{ borderRadius: 6 }}>
            Tạo phòng họp
          </Button>
          <Button icon={<VideoCameraOutlined />} onClick={() => setJoinOpen(true)} style={{ borderRadius: 6 }}>
            Tham gia bằng link
          </Button>
          <Button icon={<CalendarOutlined />} onClick={() => navigate("/schedule")} style={{ borderRadius: 6 }}>
            Xem lịch tháng
          </Button>
        </Space>
      </Card>

      <Row gutter={[16, 16]}>
        <Col xs={24} lg={12}>
          <Card title={<span style={{ fontSize: 15, fontWeight: 600 }}>Cuộc họp đang diễn ra</span>} style={{ borderRadius: 12, border: "1px solid rgba(0,0,0,0.06)", boxShadow: "0 4px 12px rgba(0,0,0,0.02)" }} bodyStyle={{ padding: 16 }}>
            <List
              dataSource={data?.ongoingMeetings ?? []}
              locale={{ emptyText: "Không có cuộc họp đang diễn ra" }}
              renderItem={(meeting) => (
                <List.Item
                  style={{ padding: "10px 12px", border: "1px solid rgba(0,0,0,0.04)", borderRadius: 8, marginBottom: 8, background: "rgba(82, 196, 26, 0.02)" }}
                  actions={[<Button key="details" type="link" onClick={() => navigate(`/meetings/${meeting._id}`)} style={{ padding: 0 }}>Chi tiết</Button>]}
                > 
                  <List.Item.Meta
                    title={<Typography.Text strong style={{ fontSize: 13 }}>{meeting.title}</Typography.Text>}
                    description={`Host: ${getHostLabel(meeting.ownerId)} • ${dayjs(meeting.startTime).format("DD/MM HH:mm")} - ${dayjs(meeting.endTime).format("HH:mm")}`}
                  />
                  <Button
                    type="primary"
                    size="small"
                    style={{ background: "#52c41a", borderColor: "#52c41a", borderRadius: 4 }}
                    onClick={() => navigate(`/room/${meeting._id}`)}
                  >
                    Vào họp (Live)
                  </Button>
                </List.Item>
              )}
            />
          </Card>
        </Col>

        <Col xs={24} lg={12}>
          <Card title={<span style={{ fontSize: 15, fontWeight: 600 }}>Cuộc họp sắp diễn ra</span>} style={{ borderRadius: 12, border: "1px solid rgba(0,0,0,0.06)", boxShadow: "0 4px 12px rgba(0,0,0,0.02)" }} bodyStyle={{ padding: 16 }}>
            <List
              dataSource={data?.upcomingMeetings ?? []}
              locale={{ emptyText: "Chưa có cuộc họp nào sắp diễn ra" }}
              renderItem={(meeting) => (
                <List.Item
                  style={{ padding: "10px 12px", border: "1px solid rgba(0,0,0,0.04)", borderRadius: 8, marginBottom: 8, background: "#fafafa" }}
                  actions={[<Button key="details" type="link" onClick={() => navigate(`/meetings/${meeting._id}`)} style={{ padding: 0 }}>Chi tiết</Button>]}
                > 
                  <List.Item.Meta
                    title={<Typography.Text strong style={{ fontSize: 13 }}>{meeting.title}</Typography.Text>}
                    description={`Host: ${getHostLabel(meeting.ownerId)} • ${dayjs(meeting.startTime).format("DD/MM HH:mm")} - ${dayjs(meeting.endTime).format("HH:mm")}`}
                  />
                  <Tag color="blue" style={{ borderRadius: 4 }}>Upcoming</Tag>
                </List.Item>
              )}
            />
          </Card>
        </Col>

        <Col xs={24}>
          <Card title={<span style={{ fontSize: 15, fontWeight: 600 }}>Lịch sử cuộc họp (đã kết thúc)</span>} style={{ borderRadius: 12, border: "1px solid rgba(0,0,0,0.06)", boxShadow: "0 4px 12px rgba(0,0,0,0.02)" }} bodyStyle={{ padding: 16 }}>
            <List
              dataSource={data?.meetingHistory ?? []}
              locale={{ emptyText: "Chưa có lịch sử cuộc họp" }}
              renderItem={(meeting) => (
                <List.Item
                  style={{ padding: "10px 12px", border: "1px solid rgba(0,0,0,0.04)", borderRadius: 8, marginBottom: 8 }}
                  actions={[<Button key="details" type="link" onClick={() => navigate(`/meetings/${meeting._id}`)} style={{ padding: 0 }}>Chi tiết</Button>]}
                > 
                  <List.Item.Meta
                    title={<Typography.Text strong style={{ fontSize: 13, color: "#6b7280" }}>{meeting.title}</Typography.Text>}
                    description={`Host: ${getHostLabel(meeting.ownerId)} • ${dayjs(meeting.startTime).format("DD/MM HH:mm")} - ${dayjs(meeting.endTime).format("HH:mm")}`}
                  />
                  <Tag color="default" style={{ borderRadius: 4 }}>Ended</Tag>
                </List.Item>
              )}
            />
          </Card>
        </Col>

        <Col xs={24}>
          <Card title={<span style={{ fontSize: 15, fontWeight: 600 }}>Lời mời đang chờ phản hồi</span>} extra={<Badge count={data?.invitations.length ?? 0} style={{ borderRadius: 6 }} />} style={{ borderRadius: 12, border: "1px solid rgba(0,0,0,0.06)", boxShadow: "0 4px 12px rgba(0,0,0,0.02)" }} bodyStyle={{ padding: 16 }}>
            <List
              dataSource={(data?.invitations ?? []) as InvitationWithMeeting[]}
              locale={{ emptyText: "Không có lời mời nào đang chờ" }}
              renderItem={(inv) => {
                const meeting = typeof inv.meetingId === "object" ? inv.meetingId : null;
                return (
                  <List.Item
                    style={{ padding: "12px 16px", border: "1px solid rgba(0,0,0,0.04)", borderRadius: 8, marginBottom: 8, background: "rgba(24, 144, 255, 0.02)" }}
                    actions={[
                      <Button key="view" type="primary" size="small" onClick={() => navigate(`/invitations/${inv._id}`)} style={{ borderRadius: 4 }}>
                        Xem & phản hồi
                      </Button>,
                    ]}
                  >
                    <List.Item.Meta
                      avatar={<MailOutlined style={{ fontSize: 18, color: "#1677ff", marginTop: 4 }} />}
                      title={<Typography.Text strong style={{ fontSize: 13 }}>{meeting?.title ?? "Cuộc họp"}</Typography.Text>}
                      description={
                        meeting
                          ? `Host: ${getHostLabel(meeting.ownerId)} • ${dayjs(meeting.startTime).format("DD/MM/YYYY HH:mm")} - ${dayjs(meeting.endTime).format("HH:mm")}`
                          : undefined
                      }
                    />
                    <Tag color="orange" style={{ borderRadius: 4 }}>Pending</Tag>
                  </List.Item>
                );
              }}
            />
          </Card>
        </Col>
      </Row>

      <Modal
        title="Tạo phòng họp mới"
        open={createOpen}
        confirmLoading={creating}
        onOk={() => void handleCreateMeeting()}
        onCancel={() => setCreateOpen(false)}
        okText="Tạo"
        cancelText="Hủy"
        style={{ borderRadius: 12 }}
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
          <Form.Item name="title" label="Tiêu đề cuộc họp" rules={[{ required: true, message: "Vui lòng nhập tiêu đề" }]}> 
            <Input placeholder="Sprint planning..." />
          </Form.Item>
          <Form.Item name="description" label="Mô tả">
            <Input.TextArea rows={2} placeholder="Nội dung/Agenda cuộc họp..." />
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
          <Form.Item name="timeRange" label="Thời gian bắt đầu/kết thúc" rules={[{ required: true, message: "Vui lòng chọn thời gian" }]}>
            <DatePicker.RangePicker showTime style={{ width: "100%" }} />
          </Form.Item>
          <Form.Item name="privacyMode" label="Quyền truy cập" rules={[{ required: true }]}> 
            <Select options={[{ value: "private", label: "Riêng tư (Private)" }, { value: "public", label: "Công khai (Public)" }]} />
          </Form.Item>
          <Form.Item name="waitingRoomEnabled" label="Bật phòng chờ" valuePropName="checked">
            <Switch />
          </Form.Item>
          <Form.Item name="isRecurring" label="Lặp lại cuộc họp định kỳ" valuePropName="checked">
            <Switch onChange={(checked) => setShowRecurrenceForm(checked)} />
          </Form.Item>
          {showRecurrenceForm && (
            <>
              <Form.Item name={["recurrence", "frequency"]} label="Tần suất lặp" rules={[{ required: true, message: "Vui lòng chọn tần suất" }]}>
                <Select
                  options={[
                    { value: "daily", label: "Hằng ngày" },
                    { value: "weekly", label: "Hằng tuần" },
                    { value: "monthly", label: "Hằng tháng" },
                  ]}
                />
              </Form.Item>
              <Form.Item name={["recurrence", "endDate"]} label="Ngày kết thúc chu kỳ lặp" rules={[{ required: true, message: "Vui lòng chọn ngày kết thúc" }]}>
                <DatePicker showTime style={{ width: "100%" }} placeholder="Chọn ngày kết thúc" />
              </Form.Item>
            </>
          )}
        </Form>
      </Modal>

      <Modal
        title="Tham gia bằng liên kết"
        open={joinOpen}
        confirmLoading={joining}
        onOk={() => void handleJoinByLink()}
        onCancel={() => setJoinOpen(false)}
        okText="Tham gia"
        cancelText="Hủy"
      >
        <Form form={joinForm} layout="vertical">
          <Form.Item
            name="linkOrId"
            label="Liên kết phòng họp hoặc ID"
            rules={[{ required: true, message: "Vui lòng nhập link hoặc meeting ID" }]}
          >
            <Input placeholder="https://app/room/<id> hoặc mã cuộc họp <id>" />
          </Form.Item>
        </Form>
      </Modal>
    </Space>
  );
};
