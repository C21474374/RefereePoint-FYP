import axiosInstance from "./axiosInstance";

export type NotificationItem = {
  id: number;
  notification_type: string;
  notification_type_display: string;
  title: string;
  message: string;
  link_path: string;
  metadata: Record<string, unknown>;
  is_read: boolean;
  created_at: string;
  read_at: string | null;
  actor_name: string | null;
};

export type NotificationListResponse = {
  items: NotificationItem[];
  unread_count: number;
};

export async function getNotifications(limit = 120) {
  const response = await axiosInstance.get<NotificationListResponse>("/notifications/", {
    params: { limit },
  });
  return response.data;
}

export async function getRecentNotifications(limit = 5) {
  const response = await axiosInstance.get<NotificationListResponse>(
    "/notifications/recent/",
    {
      params: { limit },
    }
  );
  return response.data;
}

export async function markAllNotificationsRead() {
  const response = await axiosInstance.post<{ updated: number }>(
    "/notifications/mark-all-read/"
  );
  return response.data;
}

export async function markNotificationRead(notificationId: number) {
  const response = await axiosInstance.post<NotificationItem>(
    `/notifications/${notificationId}/read/`
  );
  return response.data;
}
