/**
 * Connection Component
 *
 * Adapted from ai-sdk.dev/elements/components/connection
 * Wire to tRPC agent/orchestrator streaming subscriptions
 */

import { cn } from "@/lib/utils";

export type ChatStatus =
  | "ready"
  | "submitted"
  | "streaming"
  | "error"
  | "degraded"
  | "offline";

type ConnectProps = {
  status: ChatStatus | string;
  agent?: "assistant" | "orchestrator";
  className?: string;
};

export function Connect({ status, agent, className }: ConnectProps) {
  const statusConfig = {
    ready: {
      label: "Ready",
      color: "text-muted-foreground",
      dot: "bg-muted-foreground",
      ariaLabel: "ready",
    },
    submitted: {
      label: "Submitting…",
      color: "text-yellow-500",
      dot: "bg-yellow-500",
      ariaLabel: "submitting",
    },
    streaming: {
      label: "Streaming",
      color: "text-green-500",
      dot: "bg-green-500",
      ariaLabel: "streaming",
    },
    degraded: {
      label: "Degraded",
      color: "text-amber-500",
      dot: "bg-amber-500 animate-pulse",
      ariaLabel: "degraded performance",
    },
    offline: {
      label: "Offline",
      color: "text-red-500",
      dot: "bg-red-500",
      ariaLabel: "offline mode",
    },
    error: {
      label: "Error",
      color: "text-red-500",
      dot: "bg-red-500",
      ariaLabel: "error",
    },
  };

  const config = statusConfig[status as ChatStatus] ?? statusConfig.ready;

  return (
    <output
      aria-label={`Connection status: ${config.ariaLabel}`}
      aria-live="polite"
      className={cn("flex items-center gap-2", className)}
    >
      <div
        aria-hidden="true"
        className={cn("size-2 rounded-full", config.dot)}
      />
      <span className={cn("font-medium text-sm", config.color)}>
        {config.label}
      </span>
      {agent && (
        <span className="text-muted-foreground text-xs">({agent})</span>
      )}
    </output>
  );
}
