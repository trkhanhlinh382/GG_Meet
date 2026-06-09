import React, { useEffect, useRef } from "react";

// In Web environments, we map WebRTC components to standard browser WebRTC globals
const RTCPeerConnection = typeof window !== "undefined" ? window.RTCPeerConnection : null;
const RTCIceCandidate = typeof window !== "undefined" ? window.RTCIceCandidate : null;
const RTCSessionDescription = typeof window !== "undefined" ? window.RTCSessionDescription : null;
const mediaDevices = typeof navigator !== "undefined" ? navigator.mediaDevices : null;
const isMock = false;

// Inject toURL on MediaStream prototype to handle common react-native-webrtc patterns on web
if (typeof MediaStream !== "undefined" && !MediaStream.prototype.hasOwnProperty("toURL")) {
  Object.defineProperty(MediaStream.prototype, "toURL", {
    value: function () {
      return this;
    },
    writable: true,
    configurable: true,
  });
}

// Custom RTCView component rendering HTML5 video element on web
interface RTCViewProps {
  streamURL: any;
  objectFit?: "cover" | "contain";
  style?: any;
  muted?: boolean;
}

const RTCView: React.FC<RTCViewProps> = ({ streamURL, objectFit, style, muted }) => {
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    const video = videoRef.current;
    if (!video || !streamURL) return;

    try {
      if (typeof streamURL === "object") {
        video.srcObject = streamURL;
      } else if (typeof streamURL === "string" && streamURL.startsWith("blob:")) {
        video.src = streamURL;
      } else {
        // Direct stream assignment fallback
        video.srcObject = streamURL;
      }
    } catch (err) {
      console.error("Lỗi gán stream cho video tag trên Web:", err);
    }
  }, [streamURL]);

  return React.createElement("video", {
    ref: videoRef,
    autoPlay: true,
    playsInline: true,
    muted: muted !== undefined ? muted : true, // default to muted to avoid browser auto-play block
    style: {
      width: "100%",
      height: "100%",
      objectFit: objectFit === "cover" ? "cover" : "contain",
      backgroundColor: "#0a0c10",
      ...style,
    },
  });
};

export {
  RTCPeerConnection,
  RTCIceCandidate,
  RTCSessionDescription,
  RTCView,
  mediaDevices,
  isMock,
};
