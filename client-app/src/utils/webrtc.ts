import { Platform } from "react-native";

let RTCPeerConnection: any = null;
let RTCIceCandidate: any = null;
let RTCSessionDescription: any = null;
let RTCView: any = null;
let mediaDevices: any = null;
let isMock = true;

try {
  // Eagerly try to require react-native-webrtc on native platforms.
  // Wrapped in try-catch to support Expo Go environments where native binary modules are missing.
  const webrtc = require("react-native-webrtc");
  RTCPeerConnection = webrtc.RTCPeerConnection;
  RTCIceCandidate = webrtc.RTCIceCandidate;
  RTCSessionDescription = webrtc.RTCSessionDescription;
  RTCView = webrtc.RTCView;
  mediaDevices = webrtc.mediaDevices;
  isMock = false;
} catch (e) {
  console.warn("Không thể tải react-native-webrtc trên native (chạy ở chế độ Expo Go Mock):", e);
}

export {
  RTCPeerConnection,
  RTCIceCandidate,
  RTCSessionDescription,
  RTCView,
  mediaDevices,
  isMock,
};
