import { Calendar, Space, Typography } from "antd";
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

const statusCellStyle = (status: "ongoing" | "upcoming" | "ended") => {
  if (status === "ongoing") {
    return {
      background: "rgba(34, 197, 94, 0.12)",
      border: "1px solid rgba(34, 197, 94, 0.25)",
      color: "var(--accent-success)",
    };
  }

  if (status === "upcoming") {
    return {
      background: "rgba(56, 189, 248, 0.12)",
      border: "1px solid rgba(56, 189, 248, 0.25)",
      color: "var(--accent-info)",
    };
  }

  return {
    background: "rgba(71, 85, 105, 0.15)",
    border: "1px solid var(--border)",
    color: "var(--text-muted)",
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
      <Space direction="vertical" size={3} style={{ width: "100%" }}>
        {items.slice(0, 3).map((item) => {
          const status = getMeetingStatus(item);
          const style = statusCellStyle(status);
          return (
            <div
              key={item._id}
              onClick={() => navigate(`/meetings/${item._id}`)}
              style={{
                ...style,
                borderRadius: "var(--r-xs)",
                cursor: "pointer",
                padding: "2px 6px",
                transition: "all var(--dur-fast) var(--ease)",
              }}
            >
              <Typography.Text
                ellipsis={{
                  tooltip: `${item.title} - ${dayjs(item.startTime).format("HH:mm")} • Host: ${
                    typeof item.ownerId === "object" ? item.ownerId.fullName : "Không rõ host"
                  }`,
                }}
                style={{
                  display: "block",
                  fontSize: 11,
                  fontWeight: 600,
                  lineHeight: "16px",
                  color: style.color,
                }}
              >
                {item.title} · {dayjs(item.startTime).format("HH:mm")}
              </Typography.Text>
            </div>
          );
        })}
        {items.length > 3 ? (
          <Typography.Text
            style={{ fontSize: 10, color: "var(--text-muted)", paddingLeft: 2 }}
          >
            +{items.length - 3} cuộc họp
          </Typography.Text>
        ) : null}
      </Space>
    );
  };

  return (
    <Space direction="vertical" size={0} style={{ width: "100%" }}>
      {/* Page Header */}
      <div className="page-header">
        <h1 className="page-title">📅 Lịch họp</h1>
        <p className="page-subtitle">Xem toàn bộ lịch cuộc họp của bạn theo tháng</p>
      </div>

      {/* Calendar Card */}
      <div className="section-card">
        <div className="section-card-header">
          <span className="section-card-title">
            📆 Lịch theo tháng — {calendarDate.format("MM/YYYY")}
          </span>
          <Typography.Text style={{ fontSize: 12, color: "var(--text-muted)" }}>
            {calendarData?.meetings?.length ?? 0} cuộc họp trong tháng
          </Typography.Text>
        </div>

        <div style={{ padding: "8px 0" }}>
          <Calendar
            value={calendarDate}
            onSelect={setCalendarDate}
            onPanelChange={(value) => setCalendarDate(value)}
            cellRender={(value) => dateCellRender(value)}
            fullscreen
          />
        </div>

        {/* Legend */}
        <div
          style={{
            padding: "12px 20px",
            borderTop: "1px solid var(--border)",
            display: "flex",
            gap: 20,
            alignItems: "center",
            flexWrap: "wrap",
          }}
        >
          <Typography.Text style={{ fontSize: 12, color: "var(--text-muted)", fontWeight: 600 }}>
            Chú thích:
          </Typography.Text>
          <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
            <div
              style={{
                width: 10,
                height: 10,
                borderRadius: "50%",
                background: "var(--accent-success)",
              }}
            />
            <Typography.Text style={{ fontSize: 12, color: "var(--text-secondary)" }}>
              Đang diễn ra
            </Typography.Text>
          </div>
          <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
            <div
              style={{
                width: 10,
                height: 10,
                borderRadius: "50%",
                background: "var(--accent-info)",
              }}
            />
            <Typography.Text style={{ fontSize: 12, color: "var(--text-secondary)" }}>
              Sắp diễn ra
            </Typography.Text>
          </div>
          <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
            <div
              style={{
                width: 10,
                height: 10,
                borderRadius: "50%",
                background: "var(--text-muted)",
              }}
            />
            <Typography.Text style={{ fontSize: 12, color: "var(--text-secondary)" }}>
              Đã kết thúc
            </Typography.Text>
          </div>
        </div>
      </div>
    </Space>
  );
};
