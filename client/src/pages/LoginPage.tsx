import { GoogleLogin } from "@react-oauth/google";
import { Alert, Typography, message } from "antd";
import { http, setAuthToken } from "../api/http";

interface LoginPageProps {
  onLogin: (token: string, user: { id: string; fullName: string; email: string }) => void;
}

export const LoginPage = ({ onLogin }: LoginPageProps) => {
  const googleClientId = import.meta.env.VITE_GOOGLE_CLIENT_ID;

  const handleGoogleSuccess = async (credential?: string) => {
    if (!credential) { void message.error("Google credential không hợp lệ"); return; }
    try {
      const response = await http.post("/auth/google", { credential });
      const token = response.data.accessToken as string;
      setAuthToken(token);
      onLogin(token, {
        id: response.data.user._id,
        fullName: response.data.user.fullName,
        email: response.data.user.email,
      });
      void message.success("Đăng nhập thành công!");
    } catch {
      void message.error("Không thể xác thực. Kiểm tra GOOGLE_CLIENT_ID và API server.");
    }
  };

  return (
    <div className="auth-shell">
      {/* ── Left panel ──────────────────────────────────────────────────── */}
      <div className="auth-left">
        <div style={{ position: "relative", zIndex: 1, textAlign: "center" }}>
          {/* Logo mark */}
          <div style={{
            width: 80,
            height: 80,
            borderRadius: 24,
            background: "rgba(255,255,255,0.15)",
            backdropFilter: "blur(12px)",
            border: "1px solid rgba(255,255,255,0.25)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: 40,
            margin: "0 auto 28px",
            boxShadow: "0 8px 32px rgba(0,0,0,0.2)",
          }}>
            🎥
          </div>

          <Typography.Title
            level={1}
            style={{ color: "#fff", fontSize: 36, fontWeight: 800, marginBottom: 8, letterSpacing: -1 }}
          >
            GG Meet
          </Typography.Title>
          <Typography.Paragraph
            style={{ color: "rgba(255,255,255,0.75)", fontSize: 16, maxWidth: 320, margin: "0 auto 40px" }}
          >
            Họp thông minh, kết nối không giới hạn. Quản lý lịch họp, mời thành viên và tham gia cuộc họp video chất lượng cao.
          </Typography.Paragraph>

          {/* Feature pills */}
          <div style={{ display: "flex", flexDirection: "column", gap: 14, alignItems: "flex-start", maxWidth: 280, margin: "0 auto" }}>
            {[
              { icon: "📹", text: "Video call WebRTC chất lượng cao" },
              { icon: "💬", text: "Chat, nhãn dán & chia sẻ file" },
              { icon: "📅", text: "Lịch họp thông minh, tránh trùng lịch" },
              { icon: "🔐", text: "Phòng chờ & kiểm soát quyền truy cập" },
            ].map(({ icon, text }) => (
              <div key={text} style={{ display: "flex", alignItems: "center", gap: 12, padding: "10px 16px", background: "rgba(255,255,255,0.1)", backdropFilter: "blur(8px)", borderRadius: 12, border: "1px solid rgba(255,255,255,0.15)", width: "100%" }}>
                <span style={{ fontSize: 20 }}>{icon}</span>
                <span style={{ color: "rgba(255,255,255,0.9)", fontSize: 13, fontWeight: 500 }}>{text}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ── Right panel ─────────────────────────────────────────────────── */}
      <div className="auth-right">
        <div style={{ width: "100%", maxWidth: 360 }} className="anim-slide-up">
          {/* Brand */}
          <div style={{ marginBottom: 40, textAlign: "center" }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 10, marginBottom: 12 }}>
              <span className="brand-dot" style={{ width: 10, height: 10 }} />
              <span style={{ fontSize: 22, fontWeight: 800, color: "var(--text-primary)", letterSpacing: -0.5 }}>GG Meet</span>
            </div>
            <Typography.Title level={3} style={{ color: "var(--text-primary)", fontWeight: 700, margin: 0, fontSize: 22 }}>
              Chào mừng trở lại 👋
            </Typography.Title>
            <Typography.Paragraph style={{ color: "var(--text-secondary)", marginTop: 6, fontSize: 14 }}>
              Đăng nhập với tài khoản Google để tiếp tục
            </Typography.Paragraph>
          </div>

          {/* Missing client ID warning */}
          {!googleClientId && (
            <Alert
              type="warning"
              showIcon
              message="Thiếu VITE_GOOGLE_CLIENT_ID"
              description="Cấu hình VITE_GOOGLE_CLIENT_ID trong client/.env để bật đăng nhập Google."
              style={{ marginBottom: 24, borderRadius: 10 }}
            />
          )}

          {/* Google login button */}
          <div style={{
            background: "var(--bg-surface-2)",
            border: "1px solid var(--border-strong)",
            borderRadius: 12,
            padding: "24px",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            gap: 16,
          }}>
            <div style={{ fontSize: 13, color: "var(--text-muted)", textAlign: "center" }}>
              Tiếp tục với
            </div>
            <div style={{ transform: "scale(1.05)", transformOrigin: "center" }}>
              <GoogleLogin
                onSuccess={(credentialResponse) => {
                  void handleGoogleSuccess(credentialResponse.credential);
                }}
                onError={() => void message.error("Google Sign-In thất bại")}
                theme="filled_black"
                shape="rectangular"
                size="large"
                width="280"
              />
            </div>
            <div style={{ fontSize: 11, color: "var(--text-muted)", textAlign: "center", lineHeight: 1.5 }}>
              Bằng cách đăng nhập, bạn đồng ý với<br />Điều khoản sử dụng và Chính sách bảo mật của chúng tôi.
            </div>
          </div>

          {/* Footer */}
          <div style={{ marginTop: 32, textAlign: "center", color: "var(--text-muted)", fontSize: 12 }}>
            GG Meet Workspace v2.0 · Powered by WebRTC
          </div>
        </div>
      </div>
    </div>
  );
};
