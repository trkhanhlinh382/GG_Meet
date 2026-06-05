import axios from "axios";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { Platform } from "react-native";

// CẤU HÌNH ĐỊA CHỈ IP MÁY CHỦ:
// - iOS simulator: localhost
// - Android emulator: 10.0.2.2
// - Điện thoại thật (quét QR): Hãy thay đổi 'localhost' bên dưới thành IP LAN máy tính của bạn (VD: '192.168.1.5')
const SERVER_IP = "localhost";

export const API_BASE_URL = Platform.select({
  ios: `http://${SERVER_IP}:4000/api`,
  android: `http://10.0.2.2:4000/api`,
  default: `http://localhost:4000/api`,
});

export const SOCKET_URL = Platform.select({
  ios: `http://${SERVER_IP}:4000`,
  android: `http://10.0.2.2:4000`,
  default: `http://localhost:4000`,
});

export const http = axios.create({
  baseURL: API_BASE_URL,
  timeout: 10000,
});

// Thêm token JWT vào header của mỗi request nếu có
http.interceptors.request.use(
  async (config) => {
    try {
      const token = await AsyncStorage.getItem("token");
      if (token && config.headers) {
        config.headers.Authorization = `Bearer ${token}`;
      }
    } catch (e) {
      console.warn("Lỗi khi đọc token từ AsyncStorage:", e);
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);
