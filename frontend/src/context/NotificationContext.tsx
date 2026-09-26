import React, { createContext, ReactNode, useCallback, useContext, useEffect, useRef, useState } from "react";
import { authFetch } from "../components/auth/authStorage";
import { useAuth } from "./AuthContext";

export interface AppNotification {
  id: string;
  type: string;
  title: string;
  message: string;
  data: Record<string, unknown>;
  severity: "info" | "success" | "warning" | "error" | string;
  is_read: boolean;
  read_at?: string | null;
  created_at?: string | null;
}

interface NotificationContextValue {
  notifications: AppNotification[];
  unreadCount: number;
  refreshNotifications: () => Promise<void>;
  markRead: (id: string) => Promise<void>;
  markAllRead: () => Promise<void>;
}

const NotificationContext = createContext<NotificationContextValue | undefined>(undefined);

export const NotificationProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const { isLoggedIn, currentUser } = useAuth();
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const mounted = useRef(true);

  const refreshNotifications = useCallback(async () => {
    if (!isLoggedIn || !currentUser) {
      setNotifications([]);
      setUnreadCount(0);
      return;
    }

    try {
      const res = await authFetch("/api/notifications?limit=50&skip=0");
      if (!res.ok) throw new Error(`Notification request failed: ${res.status}`);
      const data = await res.json();
      if (!mounted.current) return;
      setNotifications(Array.isArray(data?.items) ? data.items : []);
      setUnreadCount(Number(data?.unread_count || 0));
    } catch (error) {
      if (mounted.current) {
        setNotifications([]);
        setUnreadCount(0);
      }
      console.warn("Could not load notifications:", error);
    }
  }, [isLoggedIn, currentUser?.id]);

  useEffect(() => {
    mounted.current = true;
    void refreshNotifications();

    if (!isLoggedIn) {
      return () => {
        mounted.current = false;
      };
    }

    const interval = window.setInterval(() => void refreshNotifications(), 20000);
    const onFocus = () => void refreshNotifications();
    window.addEventListener("focus", onFocus);

    return () => {
      mounted.current = false;
      window.clearInterval(interval);
      window.removeEventListener("focus", onFocus);
    };
  }, [refreshNotifications, isLoggedIn]);

  const markRead = useCallback(async (id: string) => {
    const current = notifications.find((item) => item.id === id);
    if (!current || current.is_read) return;

    try {
      const res = await authFetch(`/api/notifications/${encodeURIComponent(id)}/read`, {
        method: "PATCH",
      });
      if (!res.ok) throw new Error("Could not mark notification as read.");
      const updated = await res.json();
      setNotifications((prev) => prev.map((item) => (item.id === id ? updated : item)));
      setUnreadCount((count) => Math.max(0, count - 1));
    } catch (error) {
      console.warn("Could not mark notification as read:", error);
    }
  }, [notifications]);

  const markAllRead = useCallback(async () => {
    if (unreadCount <= 0) return;
    try {
      const res = await authFetch("/api/notifications/read-all", { method: "POST" });
      if (!res.ok) throw new Error("Could not mark notifications as read.");
      const now = new Date().toISOString();
      setNotifications((prev) => prev.map((item) => ({ ...item, is_read: true, read_at: item.read_at || now })));
      setUnreadCount(0);
    } catch (error) {
      console.warn("Could not mark all notifications as read:", error);
    }
  }, [unreadCount]);

  return (
    <NotificationContext.Provider value={{ notifications, unreadCount, refreshNotifications, markRead, markAllRead }}>
      {children}
    </NotificationContext.Provider>
  );
};

export const useNotifications = (): NotificationContextValue => {
  const context = useContext(NotificationContext);
  if (!context) throw new Error("useNotifications must be used within NotificationProvider");
  return context;
};
