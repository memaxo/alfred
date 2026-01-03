"use client";

/**
 * Execution Log - Real-time log stream
 */

import { Terminal, X } from "lucide-react";
import { useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";

type ExecutionLogProps = {
  agentId: string | null;
  onClose: () => void;
  className?: string;
};

type LogEntry = {
  id: string;
  timestamp: Date;
  level: "info" | "warn" | "error" | "debug";
  message: string;
  agentId?: string;
};

// Mock logs
const mockLogs: LogEntry[] = [
  {
    id: "1",
    timestamp: new Date(),
    level: "info",
    message: "Orchestrator initialized",
    agentId: undefined,
  },
  {
    id: "2",
    timestamp: new Date(),
    level: "info",
    message: "Wave 1 started",
    agentId: undefined,
  },
  {
    id: "3",
    timestamp: new Date(),
    level: "info",
    message: "Spawning Planner agent",
    agentId: "1",
  },
  {
    id: "4",
    timestamp: new Date(),
    level: "debug",
    message: "Plan generation started",
    agentId: "1",
  },
  {
    id: "5",
    timestamp: new Date(),
    level: "info",
    message: "Plan validated successfully",
    agentId: "1",
  },
  {
    id: "6",
    timestamp: new Date(),
    level: "info",
    message: "Wave 1 completed",
    agentId: undefined,
  },
  {
    id: "7",
    timestamp: new Date(),
    level: "info",
    message: "Wave 2 started",
    agentId: undefined,
  },
  {
    id: "8",
    timestamp: new Date(),
    level: "info",
    message: "Spawning Frontend agent",
    agentId: "2",
  },
  {
    id: "9",
    timestamp: new Date(),
    level: "info",
    message: "Spawning Backend agent",
    agentId: "3",
  },
  {
    id: "10",
    timestamp: new Date(),
    level: "debug",
    message: "Reading shell.tsx",
    agentId: "2",
  },
  {
    id: "11",
    timestamp: new Date(),
    level: "warn",
    message: "Large file detected, chunking",
    agentId: "2",
  },
];

const levelColors = {
  info: "text-blue-400",
  warn: "text-yellow-400",
  error: "text-red-400",
  debug: "text-biolum-dim",
};

export function ExecutionLog({
  agentId,
  onClose,
  className,
}: ExecutionLogProps) {
  const scrollRef = useRef<HTMLDivElement>(null);

  // Filter logs by agent if selected
  const filteredLogs = agentId
    ? mockLogs.filter((log) => !log.agentId || log.agentId === agentId)
    : mockLogs;

  // Auto-scroll to bottom
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [filteredLogs.length]);

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
          {filteredLogs.map((log) => (
            <div className="flex gap-2 py-0.5" key={log.id}>
              <span className="flex-shrink-0 text-biolum-faint">
                {log.timestamp.toLocaleTimeString()}
              </span>
              <span className={cn("flex-shrink-0", levelColors[log.level])}>
                [{log.level.toUpperCase().padEnd(5)}]
              </span>
              <span className="text-biolum-dim">{log.message}</span>
            </div>
          ))}
        </div>
      </ScrollArea>
    </div>
  );
}
