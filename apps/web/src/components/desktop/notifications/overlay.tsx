import { useEffect, useRef } from "react";
import { useShallow } from "zustand/react/shallow";

import { useDesktopStore } from "@/store/desktop";

import { NotificationCenter } from "./index";

export function NotificationOverlay() {
  const panelRef = useRef<HTMLDivElement>(null);
  const {
    isOpen,
    notifications,
    close,
    dismiss,
    dismissAll,
    markRead,
    markAllRead,
  } = useDesktopStore(
    useShallow((s) => ({
      isOpen: s.isNotificationCenterOpen,
      notifications: s.notifications,
      close: s.closeNotificationCenter,
      dismiss: s.dismissNotification,
      dismissAll: s.dismissAllNotifications,
      markRead: s.markNotificationRead,
      markAllRead: s.markAllNotificationsRead,
    }))
  );

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    const onMouseDown = (e: MouseEvent) => {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        close();
      }
    };
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        close();
      }
    };

    document.addEventListener("mousedown", onMouseDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("mousedown", onMouseDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [close, isOpen]);

  if (!isOpen) {
    return null;
  }

  return (
    <div
      className="pointer-events-auto fixed right-4 bottom-16 z-2100"
      ref={panelRef}
    >
      <NotificationCenter
        notifications={notifications}
        onDismiss={dismiss}
        onDismissAll={dismissAll}
        onMarkAllRead={markAllRead}
        onMarkRead={markRead}
      />
    </div>
  );
}
