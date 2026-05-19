import { Alert, Card, Typography, message } from "antd";
import { GoogleLogin } from "@react-oauth/google";
import { http, setAuthToken } from "../api/http";

interface LoginPageProps {
  onLogin: (token: string, user: { id: string; fullName: string; email: string }) => void;
}

export const LoginPage = ({ onLogin }: LoginPageProps) => {
  const googleClientId = import.meta.env.VITE_GOOGLE_CLIENT_ID;

  const handleGoogleSuccess = async (credential?: string) => {
    if (!credential) {
      message.error("Google credential không hợp lệ");
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
      message.success("Login thành công");
    } catch {
      message.error("Không thể xác thực Google. Kiểm tra GOOGLE_CLIENT_ID và API server.");
    }
  };

  return (
    <div className="auth-shell">
      <Card className="auth-card" title="GG Meet Workspace">
        <Typography.Paragraph>
          Đăng nhập bằng Google OAuth2 thật. Backend sẽ verify ID token với Google trước khi cấp JWT.
        </Typography.Paragraph>

        {!googleClientId && (
          <Alert
            type="warning"
            showIcon
            title="Thiếu VITE_GOOGLE_CLIENT_ID"
            description="Hãy cấu hình VITE_GOOGLE_CLIENT_ID trong client/.env để hiển thị nút login Google."
            style={{ marginBottom: 16 }}
          />
        )}

        <GoogleLogin
          onSuccess={(credentialResponse) => {
            void handleGoogleSuccess(credentialResponse.credential);
          }}
          onError={() => message.error("Google Sign-In thất bại")}
        />
      </Card>
    </div>
  );
};
