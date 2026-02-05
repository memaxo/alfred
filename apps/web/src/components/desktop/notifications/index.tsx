/**
 * Notification Center - System notifications with grouping and actions
 *
 * @see docs/execplans/desktop-evolution-prd.md Section 7.3
 */

import { AlertTriangle, Bell, Check, Info, Trash2, X } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";

import type {
  Notification,
  NotificationType,
} from "@/store/desktop/notifications";

import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";

// ─────────────────────────────────────────────────────────────────────────────
// TYPES
// ─────────────────────────────────────────────────────────────────────────────

export type {
  Notification,
  NotificationType,
} from "@/store/desktop/notifications";

interface NotificationCenterProps {
  notifications: Notification[];
  onDismiss: (id: string) => void;
  onDismissAll: () => void;
  onMarkRead: (id: string) => void;
  onMarkAllRead: () => void;
  className?: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// ICONS
// ─────────────────────────────────────────────────────────────────────────────

const typeIcons: Record<NotificationType, typeof Info> = {
  info: Info,
  success: Check,
  warning: AlertTriangle,
  error: X,
};

const typeColors: Record<NotificationType, string> = {
  info: "text-blue-400",
  success: "text-green-400",
  warning: "text-yellow-400",
  error: "text-red-400",
};

// ─────────────────────────────────────────────────────────────────────────────
// COMPONENT
// ─────────────────────────────────────────────────────────────────────────────

export function NotificationCenter({
  notifications,
  onDismiss,
  onDismissAll,
  onMarkRead,
  onMarkAllRead,
  className,
}: NotificationCenterProps) {
  const unreadCount = notifications.filter((n) => !n.read).length;
  const [focusedIndex, setFocusedIndex] = useState(-1);
  const containerRef = useRef<HTMLDivElement>(null);

  // Group notifications
  const grouped = notifications.reduce(
    (acc, notification) => {
      const group = notification.group || "Other";
      if (!acc[group]) {
        acc[group] = [];
      }
      acc[group].push(notification);
      return acc;
    },
    {} as Record<string, Notification[]>
  );

  // Flatten notifications for keyboard navigation
  const flatNotifications = notifications;

  // Keyboard navigation
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (flatNotifications.length === 0) {
        return;
      }

      switch (e.key) {
        case "ArrowDown": {
          e.preventDefault();
          setFocusedIndex((prev) =>
            prev < flatNotifications.length - 1 ? prev + 1 : prev
          );
          break;
        }
        case "ArrowUp": {
          e.preventDefault();
          setFocusedIndex((prev) => (prev > 0 ? prev - 1 : prev));
          break;
        }
        case "Enter": {
          e.preventDefault();
          if (focusedIndex >= 0) {
            const notification = flatNotifications[focusedIndex];
            if (notification) {
              onMarkRead(notification.id);
            }
          }
          break;
        }
        case "Delete":
        case "d":
        case "D": {
          e.preventDefault();
          if (focusedIndex >= 0) {
            const notification = flatNotifications[focusedIndex];
            if (notification) {
              onDismiss(notification.id);
              // Adjust focus after dismissal
              if (focusedIndex >= flatNotifications.length - 1) {
                setFocusedIndex(Math.max(0, flatNotifications.length - 2));
              }
            }
          }
          break;
        }
        case "Escape": {
          // Let parent handle close
          break;
        }
      }
    },
    [flatNotifications, focusedIndex, onDismiss, onMarkRead]
  );

  // Focus management
  useEffect(() => {
    if (containerRef.current && focusedIndex >= 0) {
      const items = containerRef.current.querySelectorAll('[role="listitem"]');
      const item = items[focusedIndex] as HTMLElement | undefined;
      item?.focus();
    }
  }, [focusedIndex]);

  // Reset focus when notifications change
  useEffect(() => {
    if (focusedIndex >= flatNotifications.length) {
      setFocusedIndex(Math.max(0, flatNotifications.length - 1));
    }
  }, [flatNotifications.length, focusedIndex]);

  return (
    <div
      ref={containerRef}
      className={cn(
        "flex w-80 flex-col rounded-xl border border-white/10 bg-void-surface shadow-xl",
        className
      )}
      onKeyDown={handleKeyDown}
      role="dialog"
      aria-label="Notification center"
      tabIndex={0}
    >
      {/* Header */}
      <div className="flex items-center justify-between border-white/5 border-b p-3">
        <div className="flex items-center gap-2">
          <Bell className="h-4 w-4 text-biolum" />
          <span className="font-medium">Notifications</span>
          {unreadCount > 0 && (
            <span className="rounded-full bg-biolum/20 px-2 py-0.5 text-biolum text-xs">
              {unreadCount}
            </span>
          )}
        </div>

        <div className="flex gap-1">
          <Button
            className="h-7 w-7"
            onClick={onMarkAllRead}
            size="icon"
            title="Mark all as read"
            variant="ghost"
          >
            <Check className="h-3 w-3" />
          </Button>
          <Button
            className="h-7 w-7"
            onClick={onDismissAll}
            size="icon"
            title="Clear all"
            variant="ghost"
          >
            <Trash2 className="h-3 w-3" />
          </Button>
        </div>
      </div>

      {/* Notifications */}
      <ScrollArea className="max-h-96">
        {notifications.length === 0 ? (
          <div className="p-8 text-center text-biolum-dim">
            No notifications
          </div>
        ) : (
          <div className="p-2">
            {Object.entries(grouped).map(([group, items]) => (
              <div key={group}>
                {Object.keys(grouped).length > 1 && (
                  <div className="mb-1 px-2 pt-2 text-biolum-dim text-xs uppercase tracking-wider">
                    {group}
                  </div>
                )}
                {items.map((notification) => (
                  <NotificationItem
                    key={notification.id}
                    notification={notification}
                    onDismiss={() => onDismiss(notification.id)}
                    onMarkRead={() => onMarkRead(notification.id)}
                  />
                ))}
              </div>
            ))}
          </div>
        )}
      </ScrollArea>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// NOTIFICATION ITEM
// ─────────────────────────────────────────────────────────────────────────────

interface NotificationItemProps {
  notification: Notification;
  onDismiss: () => void;
  onMarkRead: () => void;
}

function NotificationItem({
  notification,
  onDismiss,
  onMarkRead,
}: NotificationItemProps) {
  const Icon = typeIcons[notification.type];
  const iconColor = typeColors[notification.type];

  const timeAgo = formatTimeAgo(notification.timestamp);

  return (
    <div
      className={cn(
        "group relative rounded-lg p-2 transition-colors hover:bg-white/5",
        !notification.read && "bg-white/5"
      )}
      onClick={onMarkRead}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onMarkRead();
        }
      }}
      role="listitem"
      tabIndex={0}
    >
      <div className="flex gap-2">
        <Icon className={cn("mt-0.5 h-4 w-4 shrink-0", iconColor)} />

        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-2">
            <span className="font-medium text-sm">{notification.title}</span>
            <Button
              className="h-5 w-5 shrink-0 opacity-0 group-hover:opacity-100"
              onClick={(e) => {
                e.stopPropagation();
                onDismiss();
              }}
              size="icon"
              variant="ghost"
            >
              <X className="h-3 w-3" />
            </Button>
          </div>

          <p className="text-biolum-dim text-xs">{notification.message}</p>

          <div className="mt-1 flex items-center gap-2">
            <span className="text-biolum-dim text-xs">{timeAgo}</span>

            {notification.actions?.map((action) => (
              <Button
                className="h-5 px-2 text-xs"
                key={action.label}
                onClick={(e) => {
                  e.stopPropagation();
                  action.onClick();
                }}
                size="sm"
                variant="ghost"
              >
                {action.label}
              </Button>
            ))}
          </div>
        </div>
      </div>

      {/* Unread indicator */}
      {!notification.read && (
        <div className="absolute top-2 right-2 h-2 w-2 rounded-full bg-biolum" />
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// UTILITIES
// ─────────────────────────────────────────────────────────────────────────────

function formatTimeAgo(date: Date): string {
  const now = new Date();
  const diff = now.getTime() - date.getTime();
  const seconds = Math.floor(diff / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);

  if (days > 0) {
    return `${days}d ago`;
  }
  if (hours > 0) {
    return `${hours}h ago`;
  }
  if (minutes > 0) {
    return `${minutes}m ago`;
  }
  return "Just now";
}

export { NotificationItem };
