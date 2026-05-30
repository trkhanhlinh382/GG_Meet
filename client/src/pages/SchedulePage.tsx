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
      background: "rgba(82, 196, 26, 0.05)",
      border: "1px solid rgba(82, 196, 26, 0.18)",
      color: "#237804",
    };
  }

  if (status === "upcoming") {
    return {
      background: "rgba(24, 144, 255, 0.05)",
      border: "1px solid rgba(24, 144, 255, 0.18)",
      color: "#0958d9",
    };
  }

  return {
    background: "#fafafa",
    border: "1px solid rgba(0, 0, 0, 0.06)",
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
      <Space direction="vertical" size={4} style={{ width: "100%" }}>
        {items.slice(0, 3).map((item) => {
          const status = getMeetingStatus(item);
          const style = statusCardStyle(status);
          return (
            <Card
              key={item._id}
              size="small"
              hoverable
              onClick={() => navigate(`/meetings/${item._id}`)}
              bodyStyle={{ padding: "2px 6px" }}
              style={{
                ...style,
                borderRadius: 6,
                cursor: "pointer",
                boxShadow: "none",
              }}
            >
              <Typography.Text
                ellipsis={{ tooltip: `${item.title} - ${dayjs(item.startTime).format("HH:mm")} • Host: ${typeof item.ownerId === "object" ? item.ownerId.fullName : "Không rõ host"}` }}
                style={{
                  display: "block",
                  fontSize: 11,
                  fontWeight: 500,
                  lineHeight: "14px",
                  color: style.color,
                }}
              >
                {item.title} - {dayjs(item.startTime).format("HH:mm")}
              </Typography.Text>
            </Card>
          );
        })}
        {items.length > 3 ? <Typography.Text type="secondary" style={{ fontSize: 10 }}>+{items.length - 3} cuộc họp</Typography.Text> : null}
      </Space>
    );
  };

  return (
    <Space direction="vertical" size={16} style={{ width: "100%" }}>
      <Card
        title={<span style={{ fontSize: 16, fontWeight: 600 }}>Lịch họp theo tháng</span>}
        style={{ borderRadius: 12, border: "1px solid rgba(0,0,0,0.06)", boxShadow: "0 4px 12px rgba(0,0,0,0.02)" }}
      >
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
