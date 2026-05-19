import { CalendarOutlined, ClockCircleOutlined, MailOutlined, PlusCircleOutlined, VideoCameraOutlined } from "@ant-design/icons";
import { Badge, Button, Calendar, Card, Col, DatePicker, Form, Input, List, Modal, Row, Segmented, Select, Space, Statistic, Switch, Tag, Typography, message } from "antd";
import type { Dayjs } from "dayjs";
import dayjs from "dayjs";
import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { http } from "../api/http";
import type { CalendarPayload, DashboardPayload, InvitationWithMeeting } from "../api/types";

interface DashboardPageProps {
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
  onJoinNearestMeeting: () => Promise<void>;
}

export const DashboardPage = ({ data, onCreateMeeting, onJoinMeeting, onJoinNearestMeeting }: DashboardPageProps) => {
  const navigate = useNavigate();
  const [calendarView, setCalendarView] = useState<"day" | "week" | "month">("week");
  const [calendarDate, setCalendarDate] = useState(dayjs());
  const [calendarData, setCalendarData] = useState<CalendarPayload>();
  const [createOpen, setCreateOpen] = useState(false);
  const [joinOpen, setJoinOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const [joining, setJoining] = useState(false);
  const [createForm] = Form.useForm();
  const [joinForm] = Form.useForm();

  useEffect(() => {
    http
      .get<CalendarPayload>("/calendar", {
        params: {
          view: calendarView,
          date: calendarDate.toISOString(),
        },
      })
      .then((response) => setCalendarData(response.data))
      .catch(() => undefined);
  }, [calendarDate, calendarView]);

  const eventsByDate = useMemo(() => {
    const map = new Map<string, CalendarPayload["meetings"]>();

    for (const meeting of calendarData?.meetings ?? []) {
      const key = dayjs(meeting.startTime).format("YYYY-MM-DD");
      const current = map.get(key) ?? [];
      current.push(meeting);
      map.set(key, current);
    }

    return map;
  }, [calendarData]);

  const dateCellRender = (value: Dayjs) => {
    const items = eventsByDate.get(value.format("YYYY-MM-DD")) ?? [];

    return (
      <ul style={{ margin: 0, paddingInlineStart: 16 }}>
        {items.slice(0, 2).map((item) => (
          <li key={item._id}>
            <Badge status={item.hasConflict ? "error" : "success"} text={item.title} />
          </li>
        ))}
        {items.length > 2 && <Typography.Text type="secondary">+{items.length - 2} more</Typography.Text>}
      </ul>
    );
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
      <Row gutter={[16, 16]}>
        <Col xs={24} md={8}>
          <Card>
            <Statistic title="Upcoming Meetings" value={data?.upcomingMeetings.length ?? 0} prefix={<CalendarOutlined />} />
          </Card>
        </Col>
        <Col xs={24} md={8}>
          <Card>
            <Statistic title="Pending Invitations" value={data?.invitations.length ?? 0} prefix={<ClockCircleOutlined />} />
          </Card>
        </Col>
        <Col xs={24} md={8}>
          <Card>
            <Statistic title="Open Tasks" value={data?.tasks.length ?? 0} prefix={<VideoCameraOutlined />} />
          </Card>
        </Col>
      </Row>

      <Card>
        <Space wrap>
          <Button type="primary" icon={<PlusCircleOutlined />} onClick={() => setCreateOpen(true)}>
            Create meeting
          </Button>
          <Button icon={<VideoCameraOutlined />} onClick={() => setJoinOpen(true)}>
            Join by link
          </Button>
          <Button onClick={() => void onJoinNearestMeeting()}>Join nearest meeting</Button>
        </Space>
      </Card>

      <Row gutter={[16, 16]}>
        <Col xs={24} lg={12}>
          <Card title="Cuộc họp đang diễn ra">
            <List
              dataSource={data?.ongoingMeetings ?? []}
              locale={{ emptyText: "Không có cuộc họp đang diễn ra" }}
              renderItem={(meeting) => (
                <List.Item actions={[<Button key="details" type="link" onClick={() => navigate(`/meetings/${meeting._id}`)}>Chi tiết</Button>]}> 
                  <List.Item.Meta
                    title={meeting.title}
                    description={`${dayjs(meeting.startTime).format("DD/MM HH:mm")} - ${dayjs(meeting.endTime).format("HH:mm")}`}
                  />
                  <Tag color="green">Live</Tag>
                </List.Item>
              )}
            />
          </Card>
        </Col>

        <Col xs={24} lg={12}>
          <Card title="Lịch họp sắp tới">
            <List
              dataSource={data?.upcomingMeetings ?? []}
              locale={{ emptyText: "Chưa có cuộc họp" }}
              renderItem={(meeting) => (
                <List.Item actions={[<Button key="details" type="link" onClick={() => navigate(`/meetings/${meeting._id}`)}>Chi tiết</Button>]}> 
                  <List.Item.Meta
                    title={meeting.title}
                    description={`${dayjs(meeting.startTime).format("DD/MM HH:mm")} - ${dayjs(meeting.endTime).format("HH:mm")}`}
                  />
                  <Tag>{meeting.category}</Tag>
                </List.Item>
              )}
            />
          </Card>
        </Col>

        <Col xs={24}>
          <Card
            title={
              <Space>
                <MailOutlined />
                <span>Lời mời tham gia cuộc họp</span>
                {(data?.invitations?.length ?? 0) > 0 && (
                  <Badge count={data?.invitations.length} />
                )}
              </Space>
            }
          >
            <List
              dataSource={(data?.invitations ?? []) as InvitationWithMeeting[]}
              locale={{ emptyText: "Không có lời mời nào đang chờ" }}
              renderItem={(inv) => {
                const meeting = typeof inv.meetingId === "object" ? inv.meetingId : null;
                return (
                  <List.Item
                    actions={[
                      <Button
                        key="view"
                        type="primary"
                        size="small"
                        onClick={() => navigate(`/invitations/${inv._id}`)}
                      >
                        Xem & Phản hồi
                      </Button>,
                    ]}
                  >
                    <List.Item.Meta
                      avatar={<MailOutlined style={{ fontSize: 20, color: "#1677ff" }} />}
                      title={meeting?.title ?? "Cuộc họp"}
                      description={
                        meeting
                          ? `${dayjs(meeting.startTime).format("DD/MM/YYYY HH:mm")} - ${dayjs(meeting.endTime).format("HH:mm")}`
                          : undefined
                      }
                    />
                    <Tag color="orange">Chờ phản hồi</Tag>
                  </List.Item>
                );
              }}
            />
          </Card>
        </Col>

        <Col xs={24}>
          <Card title="Cuộc họp đã kết thúc">
            <List
              dataSource={data?.meetingHistory ?? []}
              locale={{ emptyText: "Chưa có lịch sử cuộc họp" }}
              renderItem={(meeting) => (
                <List.Item actions={[<Button key="details" type="link" onClick={() => navigate(`/meetings/${meeting._id}`)}>Chi tiết</Button>]}> 
                  <List.Item.Meta
                    title={meeting.title}
                    description={`${dayjs(meeting.startTime).format("DD/MM HH:mm")} - ${dayjs(meeting.endTime).format("HH:mm")}`}
                  />
                  <Tag color="default">Ended</Tag>
                </List.Item>
              )}
            />
          </Card>
        </Col>

        <Col xs={24}>
          <Card title="Thông báo mới">
            <List
              dataSource={data?.notifications ?? []}
              locale={{ emptyText: "Không có thông báo" }}
              renderItem={(item) => (
                <List.Item>
                  <Badge dot={!item.isRead}>
                    <Typography.Text strong>{item.title}</Typography.Text>
                  </Badge>
                  <Typography.Text type="secondary">{item.content}</Typography.Text>
                </List.Item>
              )}
            />
          </Card>
        </Col>
      </Row>

      <Card
        title="Calendar"
        extra={
          <Segmented
            options={[
              { value: "day", label: "Day" },
              { value: "week", label: "Week" },
              { value: "month", label: "Month" },
            ]}
            value={calendarView}
            onChange={(value) => setCalendarView(value as "day" | "week" | "month")}
          />
        }
      >
        <Calendar value={calendarDate} onSelect={setCalendarDate} cellRender={(value) => dateCellRender(value)} fullscreen={calendarView === "month"} />

        <List
          header="Meetings in selected window"
          dataSource={calendarData?.meetings ?? []}
          locale={{ emptyText: "Không có lịch họp" }}
          renderItem={(meeting) => (
            <List.Item>
              <Space direction="vertical" size={0}>
                <Typography.Text strong>{meeting.title}</Typography.Text>
                <Typography.Text type="secondary">
                  {dayjs(meeting.startTime).format("DD/MM/YYYY HH:mm")} - {dayjs(meeting.endTime).format("HH:mm")}
                </Typography.Text>
              </Space>
              {meeting.hasConflict ? <Tag color="red">Conflict</Tag> : <Tag color="green">Scheduled</Tag>}
            </List.Item>
          )}
        />
      </Card>

      <Modal
        title="Schedule a Meeting"
        open={createOpen}
        confirmLoading={creating}
        onOk={() => void handleCreateMeeting()}
        onCancel={() => setCreateOpen(false)}
        okText="Create"
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
          <Form.Item name="title" label="Meeting title" rules={[{ required: true, message: "Vui lòng nhập tiêu đề" }]}>
            <Input placeholder="Sprint planning" />
          </Form.Item>
          <Form.Item name="description" label="Description">
            <Input.TextArea rows={2} placeholder="Agenda..." />
          </Form.Item>
          <Form.Item name="category" label="Type" rules={[{ required: true }]}>
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
          <Form.Item name="timeRange" label="Start/End" rules={[{ required: true, message: "Vui lòng chọn thời gian" }]}>
            <DatePicker.RangePicker showTime style={{ width: "100%" }} />
          </Form.Item>
          <Form.Item name="privacyMode" label="Privacy" rules={[{ required: true }]}>
            <Select options={[{ value: "private", label: "Private" }, { value: "public", label: "Public" }]} />
          </Form.Item>
          <Form.Item name="waitingRoomEnabled" label="Waiting room" valuePropName="checked">
            <Switch />
          </Form.Item>
        </Form>
      </Modal>

      <Modal
        title="Join Meeting by Link"
        open={joinOpen}
        confirmLoading={joining}
        onOk={() => void handleJoinByLink()}
        onCancel={() => setJoinOpen(false)}
        okText="Join"
      >
        <Form form={joinForm} layout="vertical">
          <Form.Item
            name="linkOrId"
            label="Meeting link or ID"
            rules={[{ required: true, message: "Vui lòng nhập link hoặc meeting ID" }]}
          >
            <Input placeholder="https://app/room/<id> hoặc <meeting-id>" />
          </Form.Item>
        </Form>
      </Modal>
    </Space>
  );
};
