import { CalendarOutlined, MailOutlined, PlusCircleOutlined, VideoCameraOutlined } from "@ant-design/icons";
import { Badge, Button, Card, Col, DatePicker, Form, Input, List, Modal, Row, Select, Space, Switch, Tag, Typography, message } from "antd";
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
  }) => Promise<void>;
  onJoinMeeting: (rawLink: string) => Promise<void>;
}

export const MeetingsPage = ({ data, onCreateMeeting, onJoinMeeting }: MeetingsPageProps) => {
  const navigate = useNavigate();
  const [createOpen, setCreateOpen] = useState(false);
  const [joinOpen, setJoinOpen] = useState(false);
  const [creating, setCreating] = useState(false);
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
      });

      setCreateOpen(false);
      createForm.resetFields();
    } finally {
      setCreating(false);
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
      <Card>
        <Space wrap>
          <Button type="primary" icon={<PlusCircleOutlined />} onClick={() => setCreateOpen(true)}>
            Tạo phòng họp
          </Button>
          <Button icon={<VideoCameraOutlined />} onClick={() => setJoinOpen(true)}>
            Tham gia bằng link
          </Button>
          <Button icon={<CalendarOutlined />} onClick={() => navigate("/schedule")}>Xem lịch tháng</Button>
        </Space>
      </Card>

      <Row gutter={[16, 16]}>
        <Col xs={24} lg={12}>
          <Card title="Đang tham gia">
            <List
              dataSource={data?.ongoingMeetings ?? []}
              locale={{ emptyText: "Không có cuộc họp đang diễn ra" }}
              renderItem={(meeting) => (
                <List.Item actions={[<Button key="details" type="link" onClick={() => navigate(`/meetings/${meeting._id}`)}>Chi tiết</Button>]}> 
                  <List.Item.Meta
                    title={meeting.title}
                    description={`Host: ${getHostLabel(meeting.ownerId)} • ${dayjs(meeting.startTime).format("DD/MM HH:mm")} - ${dayjs(meeting.endTime).format("HH:mm")}`}
                  />
                  <Tag color="green">Live</Tag>
                </List.Item>
              )}
            />
          </Card>
        </Col>

        <Col xs={24} lg={12}>
          <Card title="Sắp tham gia">
            <List
              dataSource={data?.upcomingMeetings ?? []}
              locale={{ emptyText: "Chưa có cuộc họp" }}
              renderItem={(meeting) => (
                <List.Item actions={[<Button key="details" type="link" onClick={() => navigate(`/meetings/${meeting._id}`)}>Chi tiết</Button>]}> 
                  <List.Item.Meta
                    title={meeting.title}
                    description={`Host: ${getHostLabel(meeting.ownerId)} • ${dayjs(meeting.startTime).format("DD/MM HH:mm")} - ${dayjs(meeting.endTime).format("HH:mm")}`}
                  />
                  <Tag color="blue">Upcoming</Tag>
                </List.Item>
              )}
            />
          </Card>
        </Col>

        <Col xs={24}>
          <Card title="Đã tham gia / đã kết thúc">
            <List
              dataSource={data?.meetingHistory ?? []}
              locale={{ emptyText: "Chưa có lịch sử cuộc họp" }}
              renderItem={(meeting) => (
                <List.Item actions={[<Button key="details" type="link" onClick={() => navigate(`/meetings/${meeting._id}`)}>Chi tiết</Button>]}> 
                  <List.Item.Meta
                    title={meeting.title}
                    description={`Host: ${getHostLabel(meeting.ownerId)} • ${dayjs(meeting.startTime).format("DD/MM HH:mm")} - ${dayjs(meeting.endTime).format("HH:mm")}`}
                  />
                  <Tag color="default">Ended</Tag>
                </List.Item>
              )}
            />
          </Card>
        </Col>

        <Col xs={24}>
          <Card title="Lời mời đang chờ phản hồi" extra={<Badge count={data?.invitations.length ?? 0} />}>
            <List
              dataSource={(data?.invitations ?? []) as InvitationWithMeeting[]}
              locale={{ emptyText: "Không có lời mời nào đang chờ" }}
              renderItem={(inv) => {
                const meeting = typeof inv.meetingId === "object" ? inv.meetingId : null;
                return (
                  <List.Item
                    actions={[
                      <Button key="view" type="primary" size="small" onClick={() => navigate(`/invitations/${inv._id}`)}>
                        Xem & phản hồi
                      </Button>,
                    ]}
                  >
                    <List.Item.Meta
                      avatar={<MailOutlined style={{ fontSize: 20, color: "#1677ff" }} />}
                      title={meeting?.title ?? "Cuộc họp"}
                      description={
                        meeting
                          ? `Host: ${getHostLabel(meeting.ownerId)} • ${dayjs(meeting.startTime).format("DD/MM/YYYY HH:mm")} - ${dayjs(meeting.endTime).format("HH:mm")}`
                          : undefined
                      }
                    />
                    <Tag color="orange">Pending</Tag>
                  </List.Item>
                );
              }}
            />
          </Card>
        </Col>
      </Row>

      <Modal
        title="Tạo phòng họp"
        open={createOpen}
        confirmLoading={creating}
        onOk={() => void handleCreateMeeting()}
        onCancel={() => setCreateOpen(false)}
        okText="Tạo"
      >
        <Form
          form={createForm}
          layout="vertical"
          initialValues={{
            category: "team_meeting",
            privacyMode: "private",
            waitingRoomEnabled: true,
            timeRange: [dayjs().add(30, "minute"), dayjs().add(90, "minute")],
          }}
        >
          <Form.Item name="title" label="Tiêu đề cuộc họp" rules={[{ required: true, message: "Vui lòng nhập tiêu đề" }]}> 
            <Input placeholder="Sprint planning" />
          </Form.Item>
          <Form.Item name="description" label="Mô tả">
            <Input.TextArea rows={2} placeholder="Agenda..." />
          </Form.Item>
          <Form.Item name="category" label="Loại cuộc họp" rules={[{ required: true }]}>
            <Select
              options={[
                { value: "personal", label: "Personal" },
                { value: "interview", label: "Interview" },
                { value: "team_meeting", label: "Team Meeting" },
                { value: "client_meeting", label: "Client Meeting" },
                { value: "training", label: "Training" },
              ]}
            />
          </Form.Item>
          <Form.Item name="timeRange" label="Bắt đầu/Kết thúc" rules={[{ required: true, message: "Vui lòng chọn thời gian" }]}>
            <DatePicker.RangePicker showTime style={{ width: "100%" }} />
          </Form.Item>
          <Form.Item name="privacyMode" label="Quyền truy cập" rules={[{ required: true }]}> 
            <Select options={[{ value: "private", label: "Private" }, { value: "public", label: "Public" }]} />
          </Form.Item>
          <Form.Item name="waitingRoomEnabled" label="Phòng chờ" valuePropName="checked">
            <Switch />
          </Form.Item>
        </Form>
      </Modal>

      <Modal
        title="Tham gia bằng link"
        open={joinOpen}
        confirmLoading={joining}
        onOk={() => void handleJoinByLink()}
        onCancel={() => setJoinOpen(false)}
        okText="Tham gia"
      >
        <Form form={joinForm} layout="vertical">
          <Form.Item
            name="linkOrId"
            label="Link hoặc ID cuộc họp"
            rules={[{ required: true, message: "Vui lòng nhập link hoặc meeting ID" }]}
          >
            <Input placeholder="https://app/room/<id> hoặc <meeting-id>" />
          </Form.Item>
        </Form>
      </Modal>
    </Space>
  );
};
