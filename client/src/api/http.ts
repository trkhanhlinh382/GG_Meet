import axios from "axios";

export const http = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL ?? "http://localhost:4000/api",
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
