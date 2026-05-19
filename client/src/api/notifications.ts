import type { Notification } from "./types";

export const fetchNotifications = async (): Promise<Notification[]> => {
  const res = await http.get<Notification[]>("/notifications");
  return res.data;
};
import { http } from "./http";

export const markNotificationAsRead = async (id: string) => {
  await http.post(`/notifications/${id}/read`);
};
