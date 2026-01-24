"use client";

/**
 * Execution Log - Real-time log stream
 */

import { Loader2, Terminal, X } from "lucide-react";
import { useEffect, useRef } from "react";

import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import { trpc } from "@/utils/trpc";

type ExecutionLogProps = {
  runId: string;
  agentId: string | null;
  onClose: () => void;
  className?: string;
};

const levelColors: Record<string, string> = {
  info: "text-blue-400",
  warning: "text-yellow-400",
  error: "text-red-400",
  success: "text-green-400",
  debug: "text-biolum-dim",
};

export function ExecutionLog({
  runId,
  agentId,
  onClose,
  className,
}: ExecutionLogProps) {
  const scrollRef = useRef<HTMLDivElement>(null);

  const { data, isLoading, error } = trpc.orchestrator.logsStream.useQuery(
    {
      runId,
      agentId: agentId ?? undefined,
      limit: 100,
    },
    {
      refetchInterval: 2000, // Poll for updates every 2 seconds
    }
  );

  const logs = data?.logs ?? [];

  // Auto-scroll to bottom when logs change
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [logs.length]);

  return (
    <div className={cn("flex flex-col bg-void", className)}>
      {/* Header */}
      <div className="flex h-10 items-center justify-between border-white/5 border-b px-3">
        <div className="flex items-center gap-2">
          <Terminal className="h-4 w-4 text-biolum-dim" />
          <span className="font-medium text-sm">
            {agentId ? "Agent Logs" : "Execution Log"}
          </span>
        </div>
        <Button
          className="h-6 w-6"
          onClick={onClose}
          size="icon"
          variant="ghost"
        >
          <X className="h-4 w-4" />
        </Button>
      </div>

      {/* Log entries */}
      <ScrollArea className="flex-1" ref={scrollRef}>
        <div className="p-2 font-mono text-xs">
          {isLoading && (
            <div className="flex items-center justify-center py-4">
              <Loader2 className="h-4 w-4 animate-spin text-biolum-dim" />
            </div>
          )}
          {error && (
            <div className="py-2 text-red-400">Failed to load logs</div>
          )}
          {!isLoading && logs.length === 0 && (
            <div className="py-2 text-biolum-dim">No logs yet</div>
          )}
          {logs.map((log) => (
            <div className="flex gap-2 py-0.5" key={log.id}>
              <span className="flex-shrink-0 text-biolum-faint">
                {new Date(log.timestamp).toLocaleTimeString()}
              </span>
              <span
                className={cn(
                  "flex-shrink-0",
                  levelColors[log.type] ?? "text-biolum-dim"
                )}
              >
                [{log.type.toUpperCase().padEnd(7)}]
              </span>
              <span className="text-biolum-dim">{log.message}</span>
            </div>
          ))}
        </div>
      </ScrollArea>
    </div>
  );
}
