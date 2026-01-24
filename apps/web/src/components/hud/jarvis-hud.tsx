/**
 * JARVIS HUD Provider
 *
 * Unified wrapper component that provides the full JARVIS experience:
 * - Ambient awareness with proactive notifications
 * - Status panels showing system health
 * - Data visualization overlays
 * - Holographic styling
 *
 * Inspired by Iron Man's JARVIS interface.
 *
 * @module hud/jarvis-hud
 */

"use client";

import * as React from "react";

import {
  type AmbientConfig,
  type AmbientState,
  getJarvisGreeting,
  getJarvisStatusSummary,
  type ProactiveTrigger,
  useAmbientAwareness,
} from "@/hooks/use-ambient-awareness";
import { cn } from "@/lib/utils";

import {
  type AmbientNotificationProps,
  NotificationStack,
  useNotifications,
} from "./ambient-notification";
import { DataBar, DataRing } from "./data-stream";
import { type StatusItem, StatusPanel } from "./status-panel";

/**
 * JARVIS HUD configuration
 */
export type JarvisHUDConfig = {
  /** Enable status panel */
  statusPanel?: boolean;
  /** Status panel position */
  statusPosition?: "top-left" | "top-right" | "bottom-left" | "bottom-right";
  /** Enable notifications */
  notifications?: boolean;
  /** Notification position */
  notificationPosition?:
    | "top-right"
    | "bottom-right"
    | "top-left"
    | "bottom-left";
  /** Enable data visualizations */
  visualizations?: boolean;
  /** Enable ambient awareness */
  ambient?: boolean;
  /** Ambient configuration */
  ambientConfig?: AmbientConfig;
  /** Custom status items */
  customStatusItems?: StatusItem[];
  /** Callback when JARVIS speaks (for TTS integration) */
  onSpeak?: (message: string) => void;
};

/**
 * JARVIS context for child components
 */
type JarvisContextValue = {
  state: AmbientState;
  greeting: string;
  statusSummary: string;
  pushNotification: (
    notification: Omit<AmbientNotificationProps, "onDismiss" | "id"> & {
      id?: string;
    }
  ) => string;
  speak: (message: string) => void;
  updateSystemStatus: (updates: Partial<AmbientState["systems"]>) => void;
  updateContext: (updates: Partial<AmbientState["context"]>) => void;
};

const JarvisContext = React.createContext<JarvisContextValue | null>(null);

/**
 * Hook to access JARVIS context
 */
export function useJarvis() {
  const context = React.useContext(JarvisContext);
  if (!context) {
    throw new Error("useJarvis must be used within JarvisHUDProvider");
  }
  return context;
}

/**
 * Default status items derived from ambient state
 */
function getDefaultStatusItems(state: AmbientState): StatusItem[] {
  return [
    {
      id: "systems",
      label: "Systems",
      value: state.systems.overall.toUpperCase(),
      status:
        state.systems.overall === "nominal"
          ? "nominal"
          : state.systems.overall === "degraded"
            ? "warning"
            : state.systems.overall === "critical"
              ? "critical"
              : "processing",
    },
    {
      id: "session",
      label: "Session",
      value: `${Math.round(state.time.sessionDuration)}m`,
      status: state.time.sessionDuration > 120 ? "warning" : "nominal",
    },
    {
      id: "focus",
      label: "Focus",
      value: state.user.focusState.toUpperCase(),
      status:
        state.user.focusState === "deep"
          ? "nominal"
          : state.user.focusState === "shallow"
            ? "nominal"
            : state.user.focusState === "idle"
              ? "warning"
              : "processing",
    },
    {
      id: "energy",
      label: "Energy",
      value: `${Math.round((1 - state.user.fatiguePrediction) * 100)}%`,
      status:
        state.user.fatiguePrediction < 0.4
          ? "nominal"
          : state.user.fatiguePrediction < 0.7
            ? "warning"
            : "critical",
    },
  ];
}

/**
 * JARVIS HUD Provider Component
 */
export function JarvisHUDProvider({
  children,
  config = {},
  className,
}: {
  children: React.ReactNode;
  config?: JarvisHUDConfig;
  className?: string;
}) {
  const {
    statusPanel = true,
    statusPosition = "top-right",
    notifications = true,
    notificationPosition = "bottom-right",
    visualizations = false,
    ambient = true,
    ambientConfig = {},
    customStatusItems = [],
    onSpeak,
  } = config;

  const { notifications: notificationList, push, dismiss } = useNotifications();
  const [statusExpanded, setStatusExpanded] = React.useState(true);
  const [hasGreeted, setHasGreeted] = React.useState(false);

  // Handle proactive triggers
  const handleTrigger = React.useCallback(
    (trigger: ProactiveTrigger, state: AmbientState) => {
      const { title, body } = trigger.message(state);
      push({
        type: trigger.type,
        title,
        message: body,
        duration: trigger.priority === "critical" ? 0 : 8000,
      });

      // Optionally speak critical notifications
      if (trigger.priority === "critical" && onSpeak) {
        onSpeak(`${title}. ${body ?? ""}`);
      }
    },
    [push, onSpeak]
  );

  const { state, updateSystemStatus, updateContext } = useAmbientAwareness(
    {
      ...ambientConfig,
      enabled: ambient,
      proactiveEnabled: ambient && notifications,
    },
    ambient ? handleTrigger : undefined
  );

  // Generate greeting on mount
  const greeting = React.useMemo(
    () => getJarvisGreeting(state),
    [state.time.timeOfDay]
  );
  const statusSummary = React.useMemo(
    () => getJarvisStatusSummary(state),
    [state]
  );

  // Initial greeting (once)
  React.useEffect(() => {
    if (!hasGreeted && ambient) {
      setHasGreeted(true);
      // Slight delay for effect
      const timer = setTimeout(() => {
        if (onSpeak) {
          onSpeak(greeting);
        }
      }, 500);
      return () => clearTimeout(timer);
    }
  }, [hasGreeted, ambient, greeting, onSpeak]);

  // Combine default and custom status items
  const statusItems = React.useMemo(
    () => [...getDefaultStatusItems(state), ...customStatusItems],
    [state, customStatusItems]
  );

  // Context value
  const contextValue = React.useMemo(
    (): JarvisContextValue => ({
      state,
      greeting,
      statusSummary,
      pushNotification: push,
      speak: (message) => onSpeak?.(message),
      updateSystemStatus,
      updateContext,
    }),
    [
      state,
      greeting,
      statusSummary,
      push,
      onSpeak,
      updateSystemStatus,
      updateContext,
    ]
  );

  return (
    <JarvisContext.Provider value={contextValue}>
      <div className={cn("relative", className)}>
        {children}

        {/* Status Panel */}
        {statusPanel && (
          <StatusPanel
            className="hidden md:block"
            expanded={statusExpanded}
            items={statusItems}
            onToggle={() => setStatusExpanded((prev) => !prev)}
            position={statusPosition}
            scanLines
            title="ALFRED"
          />
        )}

        {/* Notification Stack */}
        {notifications && (
          <NotificationStack
            notifications={notificationList}
            onDismiss={dismiss}
            position={notificationPosition}
          />
        )}

        {/* Optional corner visualizations */}
        {visualizations && (
          <div className="fixed bottom-4 left-4 space-y-2">
            <DataRing
              color="#00FF88"
              label="ENERGY"
              size={60}
              value={(1 - state.user.fatiguePrediction) * 100}
            />
          </div>
        )}
      </div>
    </JarvisContext.Provider>
  );
}

/**
 * Greeting banner component
 */
export function JarvisGreeting({
  className,
  showSummary = true,
}: {
  className?: string;
  showSummary?: boolean;
}) {
  const { greeting, statusSummary } = useJarvis();

  return (
    <div className={cn("space-y-1", className)}>
      <p className="font-mono text-cyan-400 text-sm">{greeting}</p>
      {showSummary && (
        <p className="font-mono text-white/50 text-xs">{statusSummary}</p>
      )}
    </div>
  );
}

/**
 * Quick status indicator component
 */
export function JarvisStatus({ className }: { className?: string }) {
  const { state } = useJarvis();

  return (
    <div className={cn("flex items-center gap-4", className)}>
      <DataBar
        className="w-32"
        color="#00FF88"
        label="Energy"
        value={(1 - state.user.fatiguePrediction) * 100}
      />
      <div className="font-mono text-white/60 text-xs">
        <span className="text-cyan-400">
          {state.time.timeOfDay.toUpperCase()}
        </span>
        {" • "}
        <span>{Math.round(state.time.sessionDuration)}m session</span>
      </div>
    </div>
  );
}
