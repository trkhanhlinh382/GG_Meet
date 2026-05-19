import { Calendar, Card, Space, Typography } from "antd";
import dayjs, { type Dayjs } from "dayjs";
import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { http } from "../api/http";
import type { CalendarPayload, Meeting } from "../api/types";

const getMeetingStatus = (meeting: Meeting): "ongoing" | "upcoming" | "ended" => {
  const now = Date.now();
  const start = new Date(meeting.startTime).getTime();
  const end = new Date(meeting.endTime).getTime();

  if (meeting.status === "ended" || meeting.status === "cancelled" || end < now) {
    return "ended";
  }

  if (start > now) {
    return "upcoming";
  }

  return "ongoing";
};

const statusCardStyle = (status: "ongoing" | "upcoming" | "ended") => {
  if (status === "ongoing") {
    return {
      background: "#f6ffed",
      border: "1px solid #b7eb8f",
      color: "#237804",
    };
  }

  if (status === "upcoming") {
    return {
      background: "#e6f4ff",
      border: "1px solid #91caff",
      color: "#0958d9",
    };
  }

  return {
    background: "#fafafa",
    border: "1px solid #d9d9d9",
    color: "#595959",
  };
};

export const SchedulePage = () => {
  const navigate = useNavigate();
  const [calendarDate, setCalendarDate] = useState(dayjs());
  const [calendarData, setCalendarData] = useState<CalendarPayload>();

  useEffect(() => {
    http
      .get<CalendarPayload>("/calendar", {
        params: {
          view: "month",
          date: calendarDate.toISOString(),
        },
      })
      .then((response) => setCalendarData(response.data))
      .catch(() => undefined);
  }, [calendarDate]);

  const meetingsByDate = useMemo(() => {
    const map = new Map<string, Meeting[]>();
    for (const meeting of calendarData?.meetings ?? []) {
      const key = dayjs(meeting.startTime).format("YYYY-MM-DD");
      const current = map.get(key) ?? [];
      current.push(meeting);
      map.set(key, current);
    }
    return map;
  }, [calendarData]);

  const dateCellRender = (value: Dayjs) => {
    const items = meetingsByDate.get(value.format("YYYY-MM-DD")) ?? [];

    return (
      <Space direction="vertical" size={6} style={{ width: "100%" }}>
        {items.slice(0, 3).map((item) => {
          const status = getMeetingStatus(item);
          const style = statusCardStyle(status);
          return (
            <Card
              key={item._id}
              size="small"
              hoverable
              onClick={() => navigate(`/meetings/${item._id}`)}
              bodyStyle={{ padding: "4px 8px" }}
              style={{
                ...style,
                borderRadius: 8,
                cursor: "pointer",
              }}
            >
              <Typography.Text
                ellipsis={{ tooltip: `${item.title} - ${dayjs(item.startTime).format("HH:mm")} • Host: ${typeof item.ownerId === "object" ? item.ownerId.fullName : "Không rõ host"}` }}
                style={{
                  display: "block",
                  fontSize: 12,
                  lineHeight: "16px",
                  color: style.color,
                }}
              >
                {item.title} - {dayjs(item.startTime).format("HH:mm")}
              </Typography.Text>
            </Card>
          );
        })}
        {items.length > 3 ? <Typography.Text type="secondary">+{items.length - 3} cuộc họp</Typography.Text> : null}
      </Space>
    );
  };

  return (
    <Space direction="vertical" size={16} style={{ width: "100%" }}>
      <Card title="Lịch họp theo tháng">
        <Calendar
          value={calendarDate}
          onSelect={setCalendarDate}
          onPanelChange={(value) => setCalendarDate(value)}
          cellRender={(value) => dateCellRender(value)}
          fullscreen
        />
      </Card>
    </Space>
  );
};
