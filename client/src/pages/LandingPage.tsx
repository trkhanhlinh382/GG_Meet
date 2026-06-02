import {
  ArrowRightOutlined,
  CalendarOutlined,
  DesktopOutlined,
  MessageOutlined,
  SafetyOutlined,
  VideoCameraOutlined,
} from "@ant-design/icons";
import { Button, Card, Col, Row, Typography } from "antd";
import { useNavigate } from "react-router-dom";

export function LandingPage() {
  const navigate = useNavigate();

  return (
    <div
      style={{
        minHeight: "100vh",
        background: "radial-gradient(circle at top right, rgba(99, 102, 241, 0.15), var(--bg-base) 60%)",
        color: "var(--text-primary)",
        fontFamily: "'Inter', sans-serif",
        overflowX: "hidden",
      }}
    >
      {/* ─── Navigation Header ────────────────────────────────────────── */}
      <header
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          padding: "20px 40px",
          borderBottom: "1px solid var(--border)",
          backdropFilter: "blur(12px)",
          position: "sticky",
          top: 0,
          zIndex: 100,
          background: "rgba(15, 17, 23, 0.75)",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <span className="brand-dot" style={{ width: 12, height: 12 }} />
          <span style={{ fontSize: 22, fontWeight: 800, color: "#fff", letterSpacing: -0.5 }}>
            GG Meet
          </span>
        </div>
        <Button
          type="primary"
          onClick={() => navigate("/login")}
          style={{
            background: "var(--accent)",
            borderColor: "var(--accent)",
            borderRadius: "var(--r-sm)",
            fontWeight: 600,
            boxShadow: "0 0 12px var(--accent-glow)",
          }}
        >
          Đăng nhập
        </Button>
      </header>

      {/* ─── Hero Banner Section ──────────────────────────────────────── */}
      <section
        style={{
          maxWidth: 900,
          margin: "0 auto",
          padding: "100px 24px 60px",
          textAlign: "center",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
        }}
      >
        {/* Release Pill */}
        <div
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 6,
            background: "rgba(99, 102, 241, 0.12)",
            border: "1px solid var(--border-accent)",
            borderRadius: "var(--r-full)",
            padding: "6px 14px",
            fontSize: 12,
            fontWeight: 600,
            color: "var(--accent)",
            marginBottom: 28,
            boxShadow: "0 4px 12px rgba(99, 102, 241, 0.05)",
          }}
        >
          <span style={{ fontSize: 10 }}>⚡</span> Nền tảng Hội thảo Trực tuyến Thế hệ mới
        </div>

        {/* Dynamic Gradient Title */}
        <Typography.Title
          level={1}
          style={{
            color: "#fff",
            fontSize: "clamp(32px, 6vw, 54px)",
            fontWeight: 800,
            lineHeight: 1.15,
            letterSpacing: "-1.5px",
            margin: "0 auto 20px",
            maxWidth: 800,
          }}
        >
          Họp Thông Minh, Kết Nối{" "}
          <span
            style={{
              background: "linear-gradient(135deg, #818cf8, #a78bfa)",
              WebkitBackgroundClip: "text",
              WebkitTextFillColor: "transparent",
            }}
          >
            Thời Gian Thực
          </span>
        </Typography.Title>

        {/* Slogan Description */}
        <Typography.Paragraph
          style={{
            color: "var(--text-secondary)",
            fontSize: "clamp(15px, 2.5vw, 18px)",
            lineHeight: 1.6,
            maxWidth: 680,
            margin: "0 auto 40px",
          }}
        >
          Trải nghiệm họp trực tuyến cao cấp dựa trên công nghệ WebRTC độ trễ dưới 200ms,
          tích hợp bảng vẽ whiteboard đồng bộ, ghi hình cục bộ và hàng loạt công cụ tương tác mạnh mẽ.
        </Typography.Paragraph>

        {/* CTA Buttons */}
        <div style={{ display: "flex", gap: 16, flexWrap: "wrap", justifyContent: "center" }}>
          <Button
            type="primary"
            size="large"
            icon={<ArrowRightOutlined />}
            onClick={() => navigate("/login")}
            style={{
              background: "var(--accent)",
              borderColor: "var(--accent)",
              borderRadius: "var(--r-md)",
              fontWeight: 700,
              fontSize: 15,
              height: 48,
              padding: "0 28px",
              boxShadow: "0 8px 24px rgba(99, 102, 241, 0.35)",
            }}
          >
            Bắt đầu miễn phí
          </Button>
        </div>
      </section>

      {/* ─── Core Features Grid Section ─────────────────────────────── */}
      <section style={{ maxWidth: 1100, margin: "0 auto", padding: "40px 24px 100px" }}>
        <Typography.Title
          level={2}
          style={{
            color: "#fff",
            textAlign: "center",
            fontWeight: 800,
            fontSize: 28,
            marginBottom: 48,
            letterSpacing: "-0.5px",
          }}
        >
          Tính năng cao cấp có trong GG Meet
        </Typography.Title>

        <Row gutter={[24, 24]}>
          {[
            {
              icon: <VideoCameraOutlined style={{ fontSize: 24, color: "var(--accent-info)" }} />,
              title: "Đàm thoại WebRTC P2P",
              desc: "Kết nối âm thanh và hình ảnh 60FPS độ trễ cực thấp. Hỗ trợ hiển thị Avatar Radial-Gradient tự động khi tắt camera.",
            },
            {
              icon: <DesktopOutlined style={{ fontSize: 24, color: "var(--accent)" }} />,
              title: "Bảng vẽ Whiteboard đồng bộ",
              desc: "Bảng trắng tương tác chia sẻ tọa độ nét vẽ thời gian thực giữa các thành viên qua kết nối Socket.io.",
            },
            {
              icon: <MessageOutlined style={{ fontSize: 24, color: "var(--accent-success)" }} />,
              title: "Trò chuyện & Ghim tin nhắn",
              desc: "Khung chat hỗ trợ đầy đủ nhãn dán emoji lớn, đính kèm file base64 và ghim tin quan trọng pre-meeting và in-room.",
            },
            {
              icon: <DesktopOutlined style={{ fontSize: 24, color: "var(--accent-danger)" }} />,
              title: "Ghi hình Cuộc họp Cục bộ",
              desc: "Ghi lại cuộc họp qua HTML5 MediaRecorder ngay trên trình duyệt mà không tốn dung lượng lưu trữ hay băng thông máy chủ.",
            },
            {
              icon: <CalendarOutlined style={{ fontSize: 24, color: "var(--accent-warn)" }} />,
              title: "Lên lịch họp thông minh",
              desc: "Hệ thống đặt lịch nâng cao tránh trùng lặp khung giờ, tích hợp thư mời tự động và thông báo tiếng Việt.",
            },
            {
              icon: <SafetyOutlined style={{ fontSize: 24, color: "var(--accent-success)" }} />,
              title: "Quyền điều hành của Host",
              desc: "Bảo mật tuyệt đối qua tính năng Phòng chờ duyệt và khả năng gạ gẫm/kick thành viên ra khỏi phòng họp tức thì.",
            },
          ].map((feat, idx) => (
            <Col xs={24} sm={12} md={8} key={idx}>
              <Card
                style={{
                  background: "var(--bg-surface)",
                  border: "1px solid var(--border)",
                  borderRadius: "var(--r-md)",
                  height: "100%",
                  transition: "all var(--dur-normal) var(--ease)",
                  boxShadow: "var(--shadow-sm)",
                }}
                styles={{ body: { padding: 24 } }}
                className="hover-glow-card"
              >
                <div style={{ marginBottom: 16 }}>{feat.icon}</div>
                <h3
                  style={{
                    color: "#fff",
                    fontSize: 16,
                    fontWeight: 700,
                    margin: "0 0 10px 0",
                  }}
                >
                  {feat.title}
                </h3>
                <p
                  style={{
                    color: "var(--text-secondary)",
                    fontSize: 13,
                    lineHeight: 1.6,
                    margin: 0,
                  }}
                >
                  {feat.desc}
                </p>
              </Card>
            </Col>
          ))}
        </Row>
      </section>

      {/* ─── Footer Section ───────────────────────────────────────────── */}
      <footer
        style={{
          borderTop: "1px solid var(--border)",
          padding: "40px 24px",
          textAlign: "center",
          background: "var(--bg-surface)",
        }}
      >
        <Typography.Paragraph style={{ color: "var(--text-secondary)", fontSize: 13, margin: 0 }}>
          © 2026 GG Meet. Đồ án Luận án Tốt nghiệp CNTT-K65.
        </Typography.Paragraph>
        <Typography.Paragraph
          style={{ color: "var(--text-muted)", fontSize: 11, margin: "6px 0 0 0" }}
        >
          Hệ thống được phát triển trên nền tảng React + Express + WebSockets + WebRTC P2P
        </Typography.Paragraph>
      </footer>
    </div>
  );
}
