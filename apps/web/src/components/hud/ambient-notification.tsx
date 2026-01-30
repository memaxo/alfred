/**
 * Ambient Notification Component
 *
 * JARVIS-style proactive notifications that appear non-intrusively.
 * "Sir, you should know..." style alerts.
 *
 * @module hud/ambient-notification
 */

import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import {
  AlertTriangle,
  CheckCircle2,
  Info,
  MessageSquare,
  X,
  Zap,
} from "lucide-react";
import * as React from "react";

import { cn } from "@/lib/utils";

export type NotificationType =
  | "info"
  | "success"
  | "warning"
  | "critical"
  | "message";

export interface AmbientNotificationProps {
  id: string;
  type: NotificationType;
  title: string;
  message?: string;
  /** JARVIS-style opener like "Sir, you should know..." */
  opener?: string;
  /** Auto-dismiss after ms (0 = no auto-dismiss) */
  duration?: number;
  /** Timestamp */
  timestamp?: Date;
  /** Action button */
  action?: {
    label: string;
    onClick: () => void;
  };
  /** Dismiss callback */
  onDismiss?: (id: string) => void;
  /** Additional className */
  className?: string;
}

const TYPE_CONFIG: Record<
  NotificationType,
  {
    icon: React.ComponentType<{ className?: string }>;
    color: string;
    glow: string;
    borderColor: string;
  }
> = {
  info: {
    icon: Info,
    color: "text-cyan-400",
    glow: "shadow-cyan-500/20",
    borderColor: "border-cyan-500/30",
  },
  success: {
    icon: CheckCircle2,
    color: "text-emerald-400",
    glow: "shadow-emerald-500/20",
    borderColor: "border-emerald-500/30",
  },
  warning: {
    icon: AlertTriangle,
    color: "text-amber-400",
    glow: "shadow-amber-500/20",
    borderColor: "border-amber-500/30",
  },
  critical: {
    icon: Zap,
    color: "text-red-400",
    glow: "shadow-red-500/30",
    borderColor: "border-red-500/40",
  },
  message: {
    icon: MessageSquare,
    color: "text-white/80",
    glow: "shadow-white/10",
    borderColor: "border-white/20",
  },
};

/** JARVIS-style openers based on notification type */
const DEFAULT_OPENERS: Record<NotificationType, string[]> = {
  info: [
    "Sir, you should know...",
    "A brief update, Sir.",
    "For your awareness:",
  ],
  success: [
    "Task complete.",
    "Mission accomplished, Sir.",
    "Successfully executed.",
  ],
  warning: [
    "Sir, I've detected an anomaly.",
    "A matter requires attention.",
    "Heads up, Sir.",
  ],
  critical: [
    "Sir, immediate attention required.",
    "Critical alert.",
    "Priority notification, Sir.",
  ],
  message: [
    "Incoming message, Sir.",
    "You have a new message.",
    "Message received.",
  ],
};

function getDefaultOpener(type: NotificationType): string {
  const openers = DEFAULT_OPENERS[type];
  return (
    openers[Math.floor(Math.random() * openers.length)] ??
    openers[0] ??
    "For your awareness:"
  );
}

/**
 * Single ambient notification
 */
export function AmbientNotification({
  id,
  type,
  title,
  message,
  opener,
  duration = 8000,
  timestamp = new Date(),
  action,
  onDismiss,
  className,
}: AmbientNotificationProps) {
  const reduceMotion = useReducedMotion();
  const config = TYPE_CONFIG[type];
  const Icon = config.icon;
  const displayOpener = opener ?? getDefaultOpener(type);

  // Auto-dismiss timer
  React.useEffect(() => {
    if (duration > 0 && onDismiss) {
      const timer = setTimeout(() => onDismiss(id), duration);
      return () => clearTimeout(timer);
    }
  }, [id, duration, onDismiss]);

  return (
    <motion.div
      animate={{ opacity: 1, x: 0, scale: 1 }}
      className={cn(
        "relative w-80 rounded-lg border bg-black/90 shadow-xl backdrop-blur-md",
        config.borderColor,
        config.glow,
        className
      )}
      exit={{ opacity: 0, x: 100, scale: 0.9 }}
      initial={reduceMotion ? false : { opacity: 0, x: 100, scale: 0.9 }}
      layout
      transition={
        reduceMotion
          ? { duration: 0 }
          : { type: "spring", damping: 20, stiffness: 300 }
      }
    >
      {/* Accent line */}
      <div
        className={cn(
          "absolute top-0 left-0 h-full w-1 rounded-l-lg",
          type === "critical" ? "bg-red-500" : "",
          type === "warning" ? "bg-amber-500" : "",
          type === "success" ? "bg-emerald-500" : "",
          type === "info" ? "bg-cyan-500" : "",
          type === "message" ? "bg-white/50" : ""
        )}
      />

      {/* Content */}
      <div className="p-4 pl-5">
        {/* Header */}
        <div className="mb-2 flex items-start justify-between">
          <div className="flex items-center gap-2">
            <Icon className={cn("h-4 w-4 flex-shrink-0", config.color)} />
            <span className="font-mono text-[10px] text-white/50 uppercase tracking-wide">
              {timestamp.toLocaleTimeString("en-US", {
                hour12: false,
                hour: "2-digit",
                minute: "2-digit",
              })}
            </span>
          </div>
          {onDismiss && (
            <button
              className="rounded p-1 text-white/40 transition-colors hover:bg-white/10 hover:text-white/80"
              onClick={() => onDismiss(id)}
              type="button"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </div>

        {/* Opener */}
        <p className="mb-1 font-mono text-white/50 text-xs italic">
          {displayOpener}
        </p>

        {/* Title */}
        <h4 className="mb-1 font-medium text-sm text-white">{title}</h4>

        {/* Message */}
        {message && (
          <p className="text-white/70 text-xs leading-relaxed">{message}</p>
        )}

        {/* Action */}
        {action && (
          <button
            className={cn(
              "mt-3 rounded-md border px-3 py-1.5 font-mono text-xs uppercase tracking-wide transition-colors",
              config.borderColor,
              config.color,
              "hover:bg-white/5"
            )}
            onClick={action.onClick}
            type="button"
          >
            {action.label}
          </button>
        )}
      </div>

      {/* Progress bar for auto-dismiss */}
      {duration > 0 && (
        <motion.div
          animate={{ width: "0%" }}
          className={cn(
            "absolute bottom-0 left-0 h-0.5 rounded-bl-lg",
            type === "critical" ? "bg-red-500/60" : "",
            type === "warning" ? "bg-amber-500/60" : "",
            type === "success" ? "bg-emerald-500/60" : "",
            type === "info" ? "bg-cyan-500/60" : "",
            type === "message" ? "bg-white/30" : ""
          )}
          initial={{ width: "100%" }}
          transition={
            reduceMotion
              ? { duration: 0 }
              : { duration: duration / 1000, ease: "linear" }
          }
        />
      )}
    </motion.div>
  );
}

/**
 * Notification stack for multiple notifications
 */
export function NotificationStack({
  notifications,
  onDismiss,
  position = "bottom-right",
  maxVisible = 5,
  className,
}: {
  notifications: Omit<AmbientNotificationProps, "onDismiss">[];
  onDismiss: (id: string) => void;
  position?: "top-right" | "bottom-right" | "top-left" | "bottom-left";
  maxVisible?: number;
  className?: string;
}) {
  const positionClasses = {
    "top-right": "top-4 right-4",
    "bottom-right": "bottom-4 right-4",
    "top-left": "top-4 left-4",
    "bottom-left": "bottom-4 left-4",
  };

  const visibleNotifications = notifications.slice(0, maxVisible);

  return (
    <div
      className={cn(
        "fixed z-50 flex flex-col gap-3",
        positionClasses[position],
        className
      )}
    >
      <AnimatePresence mode="popLayout">
        {visibleNotifications.map((notification) => (
          <AmbientNotification
            key={notification.id}
            {...notification}
            onDismiss={onDismiss}
          />
        ))}
      </AnimatePresence>
    </div>
  );
}

/**
 * Hook for managing notifications
 */
export function useNotifications(maxHistory = 50) {
  const [notifications, setNotifications] = React.useState<
    Omit<AmbientNotificationProps, "onDismiss">[]
  >([]);

  const push = React.useCallback(
    (
      notification: Omit<AmbientNotificationProps, "onDismiss" | "id"> & {
        id?: string;
      }
    ) => {
      const id = notification.id ?? crypto.randomUUID();
      setNotifications((prev) => [
        {
          ...notification,
          id,
          timestamp: notification.timestamp ?? new Date(),
        },
        ...prev.slice(0, maxHistory - 1),
      ]);
      return id;
    },
    [maxHistory]
  );

  const dismiss = React.useCallback((id: string) => {
    setNotifications((prev) => prev.filter((n) => n.id !== id));
  }, []);

  const clear = React.useCallback(() => {
    setNotifications([]);
  }, []);

  // Helper methods for common notification types
  const info = React.useCallback(
    (title: string, message?: string) => push({ type: "info", title, message }),
    [push]
  );

  const success = React.useCallback(
    (title: string, message?: string) =>
      push({ type: "success", title, message }),
    [push]
  );

  const warning = React.useCallback(
    (title: string, message?: string) =>
      push({ type: "warning", title, message }),
    [push]
  );

  const critical = React.useCallback(
    (title: string, message?: string) =>
      push({ type: "critical", title, message, duration: 0 }), // Critical doesn't auto-dismiss
    [push]
  );

  return {
    notifications,
    push,
    dismiss,
    clear,
    info,
    success,
    warning,
    critical,
  };
}
