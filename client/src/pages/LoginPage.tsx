import { GoogleLogin } from "@react-oauth/google";
import { Alert, Typography, message } from "antd";
import { http, setAuthToken } from "../api/http";

interface LoginPageProps {
  onLogin: (token: string, user: { id: string; fullName: string; email: string }) => void;
}

export const LoginPage = ({ onLogin }: LoginPageProps) => {
  const googleClientId = import.meta.env.VITE_GOOGLE_CLIENT_ID;

  const handleGoogleSuccess = async (credential?: string) => {
    if (!credential) {
      void message.error("Google credential không hợp lệ");
      return;
    }
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
    <div
      style={{
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: "radial-gradient(circle at center, rgba(99, 102, 241, 0.12), var(--bg-base) 80%)",
        padding: 24,
      }}
    >
      <div
        className="anim-slide-up"
        style={{
          width: "100%",
          maxWidth: 400,
          background: "var(--bg-surface)",
          border: "1px solid var(--border)",
          borderRadius: "var(--r-lg)",
          padding: "48px 40px",
          boxShadow: "var(--shadow-lg)",
          textAlign: "center",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
        }}
      >
        {/* Sleek Logo Container */}
        <div
          style={{
            width: 80,
            height: 80,
            borderRadius: 24,
            background: "linear-gradient(135deg, var(--accent), #8b5cf6)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: 40,
            marginBottom: 24,
            boxShadow: "0 8px 32px var(--accent-glow)",
          }}
        >
          📹
        </div>

        {/* Title */}
        <Typography.Title
          level={2}
          style={{
            color: "#fff",
            fontSize: 28,
            fontWeight: 800,
            marginBottom: 8,
            letterSpacing: -0.5,
          }}
        >
          GG Meet
        </Typography.Title>

        {/* Slogan */}
        <Typography.Paragraph
          style={{
            color: "var(--text-secondary)",
            fontSize: 14,
            lineHeight: 1.5,
            maxWidth: 320,
            marginBottom: 36,
          }}
        >
          Họp thông minh, kết nối không giới hạn
        </Typography.Paragraph>

        {/* Missing Client ID Alert */}
        {!googleClientId && (
          <Alert
            type="warning"
            showIcon
            message="Thiếu VITE_GOOGLE_CLIENT_ID"
            description="Cấu hình VITE_GOOGLE_CLIENT_ID trong client/.env để kích hoạt đăng nhập Google."
            style={{
              width: "100%",
              marginBottom: 24,
              textAlign: "left",
              borderRadius: "var(--r-sm)",
            }}
          />
        )}

        {/* Google Authentication Container */}
        <div
          style={{
            width: "100%",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            gap: 16,
          }}
        >
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
        </div>

        {/* Terms footer */}
        <Typography.Text
          style={{
            color: "var(--text-muted)",
            fontSize: 11,
            lineHeight: 1.5,
            marginTop: 32,
            display: "block",
          }}
        >
          Bằng cách đăng nhập, bạn đồng ý với Điều khoản sử dụng và Chính sách bảo mật của chúng tôi.
        </Typography.Text>
      </div>
    </div>
  );
};
