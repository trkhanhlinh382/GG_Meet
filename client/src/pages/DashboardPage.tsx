import { CalendarOutlined, ClockCircleOutlined, PlusCircleOutlined, VideoCameraOutlined } from "@ant-design/icons";
import { Badge, Button, Calendar, Card, Col, List, Row, Segmented, Space, Statistic, Tag, Typography } from "antd";
import type { Dayjs } from "dayjs";
import dayjs from "dayjs";
import { useEffect, useMemo, useState } from "react";
import { http } from "../api/http";
import type { CalendarPayload, DashboardPayload } from "../api/types";

interface DashboardPageProps {
  data?: DashboardPayload;
  onCreateMeeting: () => void;
  onJoinMeeting: () => void;
}

export const DashboardPage = ({ data, onCreateMeeting, onJoinMeeting }: DashboardPageProps) => {
  const [calendarView, setCalendarView] = useState<"day" | "week" | "month">("week");
  const [calendarDate, setCalendarDate] = useState(dayjs());
  const [calendarData, setCalendarData] = useState<CalendarPayload>();

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
          <Button type="primary" icon={<PlusCircleOutlined />} onClick={onCreateMeeting}>
            Create meeting
          </Button>
          <Button icon={<VideoCameraOutlined />} onClick={onJoinMeeting}>
            Join by link
          </Button>
        </Space>
      </Card>

      <Row gutter={[16, 16]}>
        <Col xs={24} lg={12}>
          <Card title="Lịch họp sắp tới">
            <List
              dataSource={data?.upcomingMeetings ?? []}
              locale={{ emptyText: "Chưa có cuộc họp" }}
              renderItem={(meeting) => (
                <List.Item>
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

        <Col xs={24} lg={12}>
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
    </Space>
  );
};
