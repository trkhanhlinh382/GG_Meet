import { ConfigProvider, theme } from "antd";
import { GoogleOAuthProvider } from "@react-oauth/google";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import App from "./App";
import "./index.css";

const googleClientId = import.meta.env.VITE_GOOGLE_CLIENT_ID ?? "";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <ConfigProvider
      theme={{
        algorithm: theme.darkAlgorithm,
        token: {
          colorPrimary: "#6366f1",
          colorBgBase: "#0f1117",
          colorBgContainer: "#1a1d27",
          colorBgElevated: "#1a1d27",
          colorBgLayout: "#0f1117",
          colorBorder: "rgba(255,255,255,0.08)",
          colorBorderSecondary: "rgba(255,255,255,0.06)",
          colorText: "#f1f5f9",
          colorTextSecondary: "#94a3b8",
          colorTextTertiary: "#475569",
          borderRadius: 8,
          borderRadiusLG: 12,
          borderRadiusSM: 6,
          fontFamily: "'Inter', system-ui, -apple-system, sans-serif",
          fontSize: 14,
          colorSuccess: "#22c55e",
          colorWarning: "#f59e0b",
          colorError: "#ef4444",
          colorInfo: "#38bdf8",
          boxShadow: "0 8px 24px rgba(0,0,0,0.4)",
          boxShadowSecondary: "0 4px 12px rgba(0,0,0,0.3)",
        },
        components: {
          Layout: {
            siderBg: "#1a1d27",
            triggerBg: "#22263a",
            headerBg: "#1a1d27",
            bodyBg: "#0f1117",
          },
          Menu: {
            darkItemBg: "transparent",
            darkItemSelectedBg: "#6366f1",
            darkItemHoverBg: "#22263a",
            darkPopupBg: "#1a1d27",
            darkItemColor: "#94a3b8",
            darkItemSelectedColor: "#fff",
            itemBorderRadius: 8,
          },
          Card: {
            colorBgContainer: "#1a1d27",
            colorBorderSecondary: "rgba(255,255,255,0.08)",
          },
          Modal: {
            contentBg: "#1a1d27",
            headerBg: "#1a1d27",
          },
          Table: {
            colorBgContainer: "#1a1d27",
            headerBg: "#22263a",
            rowHoverBg: "#22263a",
          },
          Input: {
            colorBgContainer: "#22263a",
            activeBorderColor: "#6366f1",
            hoverBorderColor: "rgba(99,102,241,0.5)",
          },
          Select: {
            colorBgContainer: "#22263a",
            colorBgElevated: "#1a1d27",
            optionActiveBg: "#22263a",
            optionSelectedBg: "rgba(99,102,241,0.15)",
          },
          DatePicker: {
            colorBgContainer: "#22263a",
            colorBgElevated: "#1a1d27",
          },
          Popover: {
            colorBgElevated: "#1a1d27",
          },
          Tabs: {
            inkBarColor: "#6366f1",
            itemActiveColor: "#6366f1",
            itemSelectedColor: "#6366f1",
            itemHoverColor: "#94a3b8",
          },
          Tag: {
            defaultBg: "rgba(255,255,255,0.06)",
            defaultColor: "#94a3b8",
          },
          Badge: {
            colorBgContainer: "#1a1d27",
          },
          List: {
            colorSplit: "rgba(255,255,255,0.08)",
          },
        },
      }}
    >
      <GoogleOAuthProvider clientId={googleClientId}>
        <BrowserRouter>
          <App />
        </BrowserRouter>
      </GoogleOAuthProvider>
    </ConfigProvider>
  </StrictMode>,
);
