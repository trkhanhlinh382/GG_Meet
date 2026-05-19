import { ArrowLeftOutlined } from "@ant-design/icons";
import { Alert, Button, Card, Descriptions, Form, Input, List, Space, Tag, Typography, message } from "antd";
import type { AxiosError } from "axios";
import dayjs from "dayjs";
import { useEffect, useMemo, useState } from "react";
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
  const [form] = Form.useForm();

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
      <Tag color="green">Đang diễn ra</Tag>
    );

  const canInvite = status === "upcoming" && detail?.meeting?.ownerId === user.id;
  const isOwner = detail?.meeting?.ownerId === user.id;

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

  return (
    <Space direction="vertical" size={16} style={{ width: "100%" }}>
      <Space>
        <Button icon={<ArrowLeftOutlined />} onClick={() => navigate("/meetings")}>
          Back
        </Button>
        <Typography.Title level={4} style={{ margin: 0 }}>
          Meeting Detail
        </Typography.Title>
      </Space>

      <Card loading={loading} title={detail?.meeting?.title ?? "Chi tiết cuộc họp"} extra={statusTag}>
        {detail?.meeting ? (
          <Descriptions bordered size="small" column={1}>
            <Descriptions.Item label="Loại cuộc họp">{detail.meeting.category}</Descriptions.Item>
            <Descriptions.Item label="Quyền truy cập">{detail.meeting.privacyMode ?? "private"}</Descriptions.Item>
            <Descriptions.Item label="Bắt đầu">{dayjs(detail.meeting.startTime).format("DD/MM/YYYY HH:mm")}</Descriptions.Item>
            <Descriptions.Item label="Kết thúc">{dayjs(detail.meeting.endTime).format("DD/MM/YYYY HH:mm")}</Descriptions.Item>
            <Descriptions.Item label="Nội dung cuộc họp">{detail.meeting.description?.trim() || "Chưa có nội dung"}</Descriptions.Item>
          </Descriptions>
        ) : null}
      </Card>

      {canInvite && (
        <Card title="Mời thành viên tham gia (meeting sắp diễn ra)">
          <Form layout="inline" form={form}>
            <Form.Item name="email" rules={[{ required: true, message: "Nhập email" }, { type: "email", message: "Email không hợp lệ" }]}>
              <Input placeholder="member@example.com" style={{ width: 260 }} />
            </Form.Item>
            <Button type="primary" loading={inviting} onClick={() => void handleInvite()}>
              Mời
            </Button>
          </Form>
        </Card>
      )}

      <Card title="Danh sách lời mời tham gia">
        <List
          dataSource={detail?.invitations ?? []}
          locale={{ emptyText: "Chưa có lời mời nào" }}
          renderItem={(item) => {
            const invitedUser = typeof item.userId === "object" ? item.userId : null;
            return (
              <List.Item>
                <Space style={{ width: "100%", justifyContent: "space-between" }}>
                  <Space direction="vertical" size={0}>
                    <Typography.Text strong>{invitedUser?.fullName ?? "Người dùng"}</Typography.Text>
                    <Typography.Text type="secondary">{invitedUser?.email ?? "Không có email"}</Typography.Text>
                  </Space>
                  <Tag
                    color={
                      item.status === "accepted"
                        ? "green"
                        : item.status === "rejected"
                          ? "red"
                          : item.status === "maybe"
                            ? "blue"
                            : "orange"
                    }
                  >
                    {item.status}
                  </Tag>
                </Space>
              </List.Item>
            );
          }}
        />
      </Card>

      <Card title="Yêu cầu vào cuộc họp (join bằng link)">
        {isOwner ? (
          <List
            dataSource={detail?.waitingRequests ?? []}
            locale={{ emptyText: "Hiện chưa có ai đang chờ phê duyệt" }}
            renderItem={(item) => (
              <List.Item>
                <Space style={{ width: "100%", justifyContent: "space-between" }}>
                  <Typography.Text strong>{item.name}</Typography.Text>
                  <Typography.Text type="secondary">socket: {item.socketId}</Typography.Text>
                </Space>
              </List.Item>
            )}
          />
        ) : (
          <Alert type="info" showIcon message="Chỉ host mới xem được danh sách yêu cầu vào phòng chờ" />
        )}
      </Card>

      <Card title="Tin nhắn trong cuộc họp">
        <List
          dataSource={detail?.messages ?? []}
          locale={{ emptyText: "Chưa có tin nhắn" }}
          renderItem={(item) => (
            <List.Item>
              <Space direction="vertical" size={0} style={{ width: "100%" }}>
                <Space>
                  <Typography.Text strong>{item.senderName}</Typography.Text>
                  <Typography.Text type="secondary">{dayjs(item.createdAt).format("DD/MM HH:mm:ss")}</Typography.Text>
                </Space>
                <Typography.Text>{item.message}</Typography.Text>
              </Space>
            </List.Item>
          )}
        />
      </Card>

      <Card title="Recording">
        {!detail?.meeting?.recordingEnabled ? (
          <Alert type="info" showIcon message="Host chưa bật recording cho cuộc họp này" />
        ) : detail.meeting.recordingUrl ? (
          <Space direction="vertical" style={{ width: "100%" }}>
            <Typography.Text>Recording đã sẵn sàng:</Typography.Text>
            <a href={detail.meeting.recordingUrl} target="_blank" rel="noreferrer">
              {detail.meeting.recordingUrl}
            </a>
            <video controls style={{ width: "100%", maxWidth: 720 }} src={detail.meeting.recordingUrl} />
          </Space>
        ) : (
          <Alert type="warning" showIcon message="Host đã bật recording nhưng chưa có file record" />
        )}
      </Card>
    </Space>
  );
};
