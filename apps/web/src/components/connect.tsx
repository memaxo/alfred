/**
 * Connection Component
 * 
 * Adapted from ai-sdk.dev/elements/components/connection
 * Wire to tRPC agent/orchestrator streaming subscriptions
 */

import { cn } from "@/lib/utils";

interface ConnectProps {
  status: "connecting" | "connected" | "disconnected" | "error";
  agent?: "assistant" | "orchestrator";
  className?: string;
}

export function Connect({ status, agent, className }: ConnectProps) {
  const statusConfig = {
    connecting: {
      label: "Connecting...",
      color: "text-yellow-500",
      dot: "bg-yellow-500",
      ariaLabel: "connecting",
    },
    connected: {
      label: "Connected",
      color: "text-green-500",
      dot: "bg-green-500",
      ariaLabel: "connected",
    },
    disconnected: {
      label: "Disconnected",
      color: "text-gray-500",
      dot: "bg-gray-500",
      ariaLabel: "disconnected",
    },
    error: {
      label: "Error",
      color: "text-red-500",
      dot: "bg-red-500",
      ariaLabel: "error",
    },
  };

  const config = statusConfig[status];

  return (
    <div
      className={cn("flex items-center gap-2", className)}
      role="status"
      aria-live="polite"
      aria-label={`Connection status: ${config.ariaLabel}`}
    >
      <div
        className={cn("size-2 rounded-full", config.dot)}
        aria-hidden="true"
      />
      <span className={cn("text-sm font-medium", config.color)}>
        {config.label}
      </span>
      {agent && (
        <span className="text-xs text-muted-foreground">
          ({agent})
        </span>
      )}
    </div>
  );
}

