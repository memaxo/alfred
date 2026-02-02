import type { StateCreator } from "zustand";

// ─────────────────────────────────────────────────────────────────────────────
// TYPES
// ─────────────────────────────────────────────────────────────────────────────

export type NotificationType = "info" | "success" | "warning" | "error";

export interface NotificationAction {
  label: string;
  onClick: () => void;
}

export interface Notification {
  id: string;
  type: NotificationType;
  title: string;
  message: string;
  timestamp: Date;
  read: boolean;
  group?: string;
  actions?: NotificationAction[];
}

export interface NotificationsSlice {
  notifications: Notification[];
  isNotificationCenterOpen: boolean;
  addNotification: (
    input: Omit<Notification, "id" | "timestamp" | "read"> & {
      id?: string;
      timestamp?: Date;
      read?: boolean;
    }
  ) => string;
  dismissNotification: (id: string) => void;
  dismissAllNotifications: () => void;
  markNotificationRead: (id: string) => void;
  markAllNotificationsRead: () => void;
  openNotificationCenter: () => void;
  closeNotificationCenter: () => void;
  toggleNotificationCenter: () => void;
}

// ─────────────────────────────────────────────────────────────────────────────
// SLICE
// ─────────────────────────────────────────────────────────────────────────────

const MAX_NOTIFICATIONS = 100;

function createNotificationId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

export const createNotificationsSlice: StateCreator<
  NotificationsSlice,
  [],
  [],
  NotificationsSlice
> = (set, get) => ({
  notifications: [],
  isNotificationCenterOpen: false,

  addNotification: (input) => {
    const id = input.id ?? createNotificationId();
    const notification: Notification = {
      id,
      type: input.type,
      title: input.title,
      message: input.message,
      group: input.group,
      actions: input.actions,
      timestamp: input.timestamp ?? new Date(),
      read: input.read ?? false,
    };

    set((state) => ({
      notifications: [notification, ...state.notifications].slice(
        0,
        MAX_NOTIFICATIONS
      ),
    }));
    return id;
  },

  dismissNotification: (id) => {
    set((state) => ({
      notifications: state.notifications.filter((n) => n.id !== id),
    }));
  },

  dismissAllNotifications: () => {
    set({ notifications: [] });
  },

  markNotificationRead: (id) => {
    set((state) => ({
      notifications: state.notifications.map((n) =>
        n.id === id ? { ...n, read: true } : n
      ),
    }));
  },

  markAllNotificationsRead: () => {
    set((state) => ({
      notifications: state.notifications.map((n) => ({ ...n, read: true })),
    }));
  },

  openNotificationCenter: () => {
    set({ isNotificationCenterOpen: true });
  },

  closeNotificationCenter: () => {
    set({ isNotificationCenterOpen: false });
  },

  toggleNotificationCenter: () => {
    set({ isNotificationCenterOpen: !get().isNotificationCenterOpen });
  },
});
