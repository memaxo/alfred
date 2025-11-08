/**
 * Connection Component
 * 
 * Adapted from ai-sdk.dev/elements/components/connection
 * Wire to tRPC agent/orchestrator streaming subscriptions
 */

import { cn } from "@/lib/utils";

type ChatStatus = "ready" | "submitted" | "streaming" | "error";

interface ConnectProps {
  status: ChatStatus;
  agent?: "assistant" | "orchestrator";
  className?: string;
}

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
    error: {
      label: "Error",
      color: "text-red-500",
      dot: "bg-red-500",
      ariaLabel: "error",
    },
  };

  const config = statusConfig[status] ?? statusConfig.ready;

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
