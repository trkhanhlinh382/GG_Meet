import axios from "axios";

export const http = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL ?? "http://localhost:4000/api",
  timeout: 15000,
});

export const setAuthToken = (token?: string): void => {
  if (token) {
    http.defaults.headers.common.Authorization = `Bearer ${token}`;
    localStorage.setItem("gg_meet_access_token", token);
    return;
  }
  delete http.defaults.headers.common.Authorization;
  localStorage.removeItem("gg_meet_access_token");
};

let onUnauthorizedCallback: (() => void) | null = null;

export const registerUnauthorizedCallback = (callback: () => void) => {
  onUnauthorizedCallback = callback;
};

// Global 401 interceptor — redirect to login on expired/invalid token
http.interceptors.response.use(
  (response) => response,
  (error) => {
    if (axios.isAxiosError(error) && error.response?.status === 401) {
      setAuthToken(undefined);
      localStorage.removeItem("gg_meet_user");
      if (onUnauthorizedCallback) {
        onUnauthorizedCallback();
      } else {
        // Fallback if React hasn't registered callback yet
        if (!window.location.pathname.startsWith("/login")) {
          window.location.href = "/login";
        }
      }
    }
    return Promise.reject(error);
  },
);
