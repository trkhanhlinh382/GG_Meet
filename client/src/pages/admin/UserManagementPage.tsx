import {
  DeleteOutlined,
  EditOutlined,
  PlusOutlined,
  SearchOutlined,
} from "@ant-design/icons";
import {
  Avatar,
  Button,
  Form,
  Input,
  Modal,
  Popconfirm,
  Select,
  Space,
  Table,
  Tag,
  Tooltip,
  message,
} from "antd";
import { useCallback, useEffect, useState } from "react";
import { http } from "../../api/http";

interface User {
  _id: string;
  fullName: string;
  email: string;
  role: string;
  avatar?: string;
  timezone?: string;
  createdAt?: string;
}

interface UserListResponse {
  users: User[];
  total: number;
  page: number;
  limit: number;
}

export const UserManagementPage = () => {
  const [users, setUsers] = useState<User[]>([]);
  const [total, setTotal] = useState<number>(0);
  const [loading, setLoading] = useState<boolean>(false);
  const [page, setPage] = useState<number>(1);
  const [limit] = useState<number>(10);
  const [search, setSearch] = useState<string>("");
  const [roleFilter, setRoleFilter] = useState<string>("");

  // Modals visibility
  const [isAddModalOpen, setIsAddModalOpen] = useState<boolean>(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState<boolean>(false);
  const [selectedUser, setSelectedUser] = useState<User | null>(null);

  // Forms
  const [addForm] = Form.useForm();
  const [editForm] = Form.useForm();

  const fetchUsers = useCallback(async () => {
    try {
      setLoading(true);
      const response = await http.get<UserListResponse>("/admin/users", {
        params: {
          search,
          role: roleFilter,
          page,
          limit,
        },
      });
      setUsers(response.data.users);
      setTotal(response.data.total);
    } catch {
      void message.error("Không thể tải danh sách người dùng.");
    } finally {
      setLoading(false);
    }
  }, [search, roleFilter, page, limit]);

  useEffect(() => {
    void fetchUsers();
  }, [fetchUsers]);

  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSearch(e.target.value);
    setPage(1);
  };

  const handleRoleFilterChange = (val: string) => {
    setRoleFilter(val);
    setPage(1);
  };

  // Create User
  const handleAddSubmit = async (values: any) => {
    try {
      setLoading(true);
      await http.post("/admin/users", values);
      void message.success("Đã tạo người dùng mới thành công!");
      setIsAddModalOpen(false);
      addForm.resetFields();
      void fetchUsers();
    } catch (error: any) {
      const errorMsg = error?.response?.data?.message || "Không thể tạo người dùng.";
      void message.error(errorMsg);
    } finally {
      setLoading(false);
    }
  };

  // Edit User
  const handleEditClick = (user: User) => {
    setSelectedUser(user);
    editForm.setFieldsValue({
      fullName: user.fullName,
      email: user.email,
      role: user.role,
      timezone: user.timezone || "UTC",
    });
    setIsEditModalOpen(true);
  };

  const handleEditSubmit = async (values: any) => {
    if (!selectedUser) return;
    try {
      setLoading(true);
      await http.put(`/admin/users/${selectedUser._id}`, values);
      void message.success("Đã cập nhật thông tin người dùng!");
      setIsEditModalOpen(false);
      setSelectedUser(null);
      void fetchUsers();
    } catch (error: any) {
      const errorMsg = error?.response?.data?.message || "Không thể cập nhật người dùng.";
      void message.error(errorMsg);
    } finally {
      setLoading(false);
    }
  };

  // Delete User
  const handleDeleteUser = async (userId: string) => {
    try {
      setLoading(true);
      await http.delete(`/admin/users/${userId}`);
      void message.success("Đã xóa người dùng thành công.");
      void fetchUsers();
    } catch (error: any) {
      const errorMsg = error?.response?.data?.message || "Không thể xóa người dùng.";
      void message.error(errorMsg);
    } finally {
      setLoading(false);
    }
  };

  const getRoleTagColor = (role: string) => {
    switch (role) {
      case "super_admin":
        return "purple";
      case "admin":
        return "red";
      case "manager":
        return "gold";
      case "host":
        return "blue";
      case "team_member":
        return "cyan";
      case "freelancer":
        return "geekblue";
      default:
        return "default";
    }
  };

  const getRoleLabel = (role: string) => {
    switch (role) {
      case "super_admin":
        return "Super Admin";
      case "admin":
        return "Admin";
      case "manager":
        return "Manager";
      case "host":
        return "Host";
      case "team_member":
        return "Team Member";
      case "freelancer":
        return "Freelancer";
      case "personal":
        return "Personal";
      default:
        return role;
    }
  };

  const columns = [
    {
      title: "Họ và tên",
      dataIndex: "fullName",
      key: "fullName",
      render: (text: string, record: User) => (
        <Space>
          <Avatar src={record.avatar} style={{ border: "1px solid var(--border-strong)" }}>
            {text.charAt(0).toUpperCase()}
          </Avatar>
          <span style={{ color: "#fff", fontWeight: 600 }}>{text}</span>
        </Space>
      ),
    },
    {
      title: "Email",
      dataIndex: "email",
      key: "email",
      render: (text: string) => <span style={{ color: "var(--text-secondary)" }}>{text}</span>,
    },
    {
      title: "Vai trò",
      dataIndex: "role",
      key: "role",
      render: (role: string) => (
        <Tag color={getRoleTagColor(role)} style={{ fontWeight: 500 }}>
          {getRoleLabel(role)}
        </Tag>
      ),
    },
    {
      title: "Múi giờ",
      dataIndex: "timezone",
      key: "timezone",
      render: (text?: string) => <span style={{ color: "var(--text-muted)" }}>{text || "UTC"}</span>,
    },
    {
      title: "Ngày tham gia",
      dataIndex: "createdAt",
      key: "createdAt",
      render: (date?: string) => (
        <span style={{ color: "var(--text-muted)", fontSize: 13 }}>
          {date ? new Date(date).toLocaleString("vi-VN") : "—"}
        </span>
      ),
    },
    {
      title: "Thao tác",
      key: "actions",
      render: (_: any, record: User) => (
        <Space size="middle">
          <Tooltip title="Chỉnh sửa">
            <Button
              type="text"
              icon={<EditOutlined style={{ color: "var(--accent)" }} />}
              onClick={() => handleEditClick(record)}
            />
          </Tooltip>
          <Tooltip title="Xóa người dùng">
            <Popconfirm
              title="Bạn có chắc chắn muốn xóa người dùng này?"
              description="Hành động này không thể hoàn tác."
              onConfirm={() => void handleDeleteUser(record._id)}
              okText="Xóa"
              cancelText="Hủy"
              okButtonProps={{ danger: true }}
            >
              <Button type="text" icon={<DeleteOutlined style={{ color: "var(--error)" }} />} />
            </Popconfirm>
          </Tooltip>
        </Space>
      ),
    },
  ];

  const roleOptions = [
    { value: "personal", label: "Personal" },
    { value: "freelancer", label: "Freelancer" },
    { value: "team_member", label: "Team Member" },
    { value: "host", label: "Host" },
    { value: "manager", label: "Manager" },
    { value: "admin", label: "Admin" },
    { value: "super_admin", label: "Super Admin" },
  ];

  return (
    <div className="anim-slide-up">
      {/* Action Header bar */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          flexWrap: "wrap",
          gap: 16,
          marginBottom: 20,
        }}
      >
        <Space size="middle" style={{ flexWrap: "wrap" }}>
          <Input
            placeholder="Tìm theo tên hoặc email..."
            prefix={<SearchOutlined style={{ color: "var(--text-muted)" }} />}
            value={search}
            onChange={handleSearchChange}
            style={{ width: 280, borderRadius: 8 }}
            allowClear
          />
          <Select
            placeholder="Lọc vai trò"
            style={{ width: 160 }}
            value={roleFilter}
            onChange={handleRoleFilterChange}
            allowClear
            options={[
              { value: "", label: "Tất cả vai trò" },
              ...roleOptions,
            ]}
          />
        </Space>
        <Button
          type="primary"
          icon={<PlusOutlined />}
          style={{ borderRadius: 8, background: "var(--accent)", border: "none" }}
          onClick={() => setIsAddModalOpen(true)}
        >
          Thêm thành viên
        </Button>
      </div>

      {/* Main Table */}
      <Table
        dataSource={users}
        columns={columns}
        rowKey="_id"
        loading={loading}
        pagination={{
          current: page,
          pageSize: limit,
          total: total,
          onChange: (p) => setPage(p),
          showSizeChanger: false,
          style: { marginTop: 16 },
        }}
        locale={{ emptyText: "Không tìm thấy người dùng nào" }}
        style={{ background: "transparent" }}
      />

      {/* Add User Modal */}
      <Modal
        title={<span style={{ color: "#fff", fontSize: 16, fontWeight: 700 }}>Thêm thành viên mới</span>}
        open={isAddModalOpen}
        onCancel={() => setIsAddModalOpen(false)}
        footer={null}
        destroyOnClose
      >
        <Form form={addForm} layout="vertical" onFinish={(vals) => void handleAddSubmit(vals)} style={{ marginTop: 16 }}>
          <Form.Item
            name="fullName"
            label={<span style={{ color: "var(--text-secondary)" }}>Họ và tên</span>}
            rules={[{ required: true, message: "Vui lòng nhập họ tên" }]}
          >
            <Input placeholder="Nguyễn Văn A" style={{ borderRadius: 6 }} />
          </Form.Item>

          <Form.Item
            name="email"
            label={<span style={{ color: "var(--text-secondary)" }}>Email</span>}
            rules={[
              { required: true, message: "Vui lòng nhập email" },
              { type: "email", message: "Email không đúng định dạng" },
            ]}
          >
            <Input placeholder="example@gmail.com" style={{ borderRadius: 6 }} />
          </Form.Item>

          <Form.Item
            name="role"
            label={<span style={{ color: "var(--text-secondary)" }}>Vai trò</span>}
            initialValue="personal"
            rules={[{ required: true }]}
          >
            <Select options={roleOptions} style={{ borderRadius: 6 }} />
          </Form.Item>

          <Form.Item
            name="timezone"
            label={<span style={{ color: "var(--text-secondary)" }}>Múi giờ</span>}
            initialValue="Asia/Ho_Chi_Minh"
          >
            <Select
              options={[
                { value: "Asia/Ho_Chi_Minh", label: "Asia/Ho_Chi_Minh (GMT+7)" },
                { value: "UTC", label: "UTC (GMT+0)" },
                { value: "America/New_York", label: "America/New_York (EST)" },
                { value: "Europe/London", label: "Europe/London (GMT)" },
              ]}
              style={{ borderRadius: 6 }}
            />
          </Form.Item>

          <Form.Item style={{ display: "flex", justifyContent: "flex-end", marginBottom: 0, marginTop: 24 }}>
            <Space>
              <Button onClick={() => setIsAddModalOpen(false)} style={{ borderRadius: 6 }}>
                Hủy
              </Button>
              <Button
                type="primary"
                htmlType="submit"
                loading={loading}
                style={{ borderRadius: 6, background: "var(--accent)", border: "none" }}
              >
                Xác nhận
              </Button>
            </Space>
          </Form.Item>
        </Form>
      </Modal>

      {/* Edit User Modal */}
      <Modal
        title={<span style={{ color: "#fff", fontSize: 16, fontWeight: 700 }}>Chỉnh sửa thông tin người dùng</span>}
        open={isEditModalOpen}
        onCancel={() => {
          setIsEditModalOpen(false);
          setSelectedUser(null);
        }}
        footer={null}
        destroyOnClose
      >
        <Form form={editForm} layout="vertical" onFinish={(vals) => void handleEditSubmit(vals)} style={{ marginTop: 16 }}>
          <Form.Item
            name="fullName"
            label={<span style={{ color: "var(--text-secondary)" }}>Họ và tên</span>}
            rules={[{ required: true, message: "Vui lòng nhập họ tên" }]}
          >
            <Input placeholder="Nguyễn Văn A" style={{ borderRadius: 6 }} />
          </Form.Item>

          <Form.Item
            name="email"
            label={<span style={{ color: "var(--text-secondary)" }}>Email</span>}
            rules={[
              { required: true, message: "Vui lòng nhập email" },
              { type: "email", message: "Email không đúng định dạng" },
            ]}
          >
            <Input placeholder="example@gmail.com" style={{ borderRadius: 6 }} />
          </Form.Item>

          <Form.Item
            name="role"
            label={<span style={{ color: "var(--text-secondary)" }}>Vai trò</span>}
            rules={[{ required: true }]}
          >
            <Select options={roleOptions} style={{ borderRadius: 6 }} />
          </Form.Item>

          <Form.Item name="timezone" label={<span style={{ color: "var(--text-secondary)" }}>Múi giờ</span>}>
            <Select
              options={[
                { value: "Asia/Ho_Chi_Minh", label: "Asia/Ho_Chi_Minh (GMT+7)" },
                { value: "UTC", label: "UTC (GMT+0)" },
                { value: "America/New_York", label: "America/New_York (EST)" },
                { value: "Europe/London", label: "Europe/London (GMT)" },
              ]}
              style={{ borderRadius: 6 }}
            />
          </Form.Item>

          <Form.Item style={{ display: "flex", justifyContent: "flex-end", marginBottom: 0, marginTop: 24 }}>
            <Space>
              <Button
                onClick={() => {
                  setIsEditModalOpen(false);
                  setSelectedUser(null);
                }}
                style={{ borderRadius: 6 }}
              >
                Hủy
              </Button>
              <Button
                type="primary"
                htmlType="submit"
                loading={loading}
                style={{ borderRadius: 6, background: "var(--accent)", border: "none" }}
              >
                Lưu thay đổi
              </Button>
            </Space>
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
};
