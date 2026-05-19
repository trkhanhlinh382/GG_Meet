import { Button, Descriptions, Form, Input, Modal, Space, Tag, Typography, message } from "antd";
import dayjs from "dayjs";
import { useMemo, useState } from "react";
import type { Meeting } from "../api/types";

interface MeetingDetailModalProps {
  open: boolean;
  meeting?: Meeting;
  onClose: () => void;
  onInviteMember: (meetingId: string, email: string) => Promise<void>;
}

export const MeetingDetailModal = ({ open, meeting, onClose, onInviteMember }: MeetingDetailModalProps) => {
  const [form] = Form.useForm();
  const [inviting, setInviting] = useState(false);

  const status = useMemo(() => {
    if (!meeting) {
      return "unknown";
    }

    const now = Date.now();
    const start = new Date(meeting.startTime).getTime();
    const end = new Date(meeting.endTime).getTime();

    if (end < now || meeting.status === "ended" || meeting.status === "cancelled") {
      return "ended";
    }

    if (start > now) {
      return "upcoming";
    }

    return "ongoing";
  }, [meeting]);

  const statusTag =
    status === "ended" ? (
      <Tag color="default">Đã kết thúc</Tag>
    ) : status === "upcoming" ? (
      <Tag color="blue">Sắp diễn ra</Tag>
    ) : (
      <Tag color="green">Đang diễn ra</Tag>
    );

  const handleInvite = async () => {
    if (!meeting) {
      return;
    }

    const values = await form.validateFields();
    setInviting(true);

    try {
      await onInviteMember(meeting._id, values.email);
      message.success("Đã gửi lời mời");
      form.resetFields();
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Không thể gửi lời mời";
      message.error(errorMessage);
    } finally {
      setInviting(false);
    }
  };

  return (
    <Modal title="Chi tiết cuộc họp" open={open} onCancel={onClose} footer={null} destroyOnClose>
      {!meeting ? (
        <Typography.Text type="secondary">Không có dữ liệu cuộc họp</Typography.Text>
      ) : (
        <Space direction="vertical" style={{ width: "100%" }} size={16}>
          <Space>
            <Typography.Title level={5} style={{ margin: 0 }}>
              {meeting.title}
            </Typography.Title>
            {statusTag}
          </Space>

          <Descriptions column={1} size="small" bordered>
            <Descriptions.Item label="Loại cuộc họp">{meeting.category}</Descriptions.Item>
            <Descriptions.Item label="Quyền truy cập">{meeting.privacyMode ?? "private"}</Descriptions.Item>
            <Descriptions.Item label="Bắt đầu">{dayjs(meeting.startTime).format("DD/MM/YYYY HH:mm")}</Descriptions.Item>
            <Descriptions.Item label="Kết thúc">{dayjs(meeting.endTime).format("DD/MM/YYYY HH:mm")}</Descriptions.Item>
            <Descriptions.Item label="Nội dung cuộc họp">{meeting.description?.trim() ? meeting.description : "Chưa có nội dung"}</Descriptions.Item>
          </Descriptions>

          {status === "upcoming" && (
            <div>
              <Typography.Title level={5}>Mời thành viên tham gia</Typography.Title>
              <Form form={form} layout="inline">
                <Form.Item name="email" rules={[{ required: true, message: "Nhập email" }, { type: "email", message: "Email không hợp lệ" }]}>
                  <Input placeholder="member@example.com" style={{ width: 260 }} />
                </Form.Item>
                <Button type="primary" loading={inviting} onClick={() => void handleInvite()}>
                  Mời
                </Button>
              </Form>
            </div>
          )}
        </Space>
      )}
    </Modal>
  );
};
