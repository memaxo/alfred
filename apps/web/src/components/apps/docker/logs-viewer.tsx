"use client";

/**
 * Logs Viewer - Real-time log streaming
 */

import { Search } from "lucide-react";
import { useEffect, useRef } from "react";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";

type LogsViewerProps = {
  containerId: string;
  className?: string;
};

// Mock log lines
const mockLogs = [
  {
    timestamp: "2026-01-03T09:30:00Z",
    level: "info",
    message: "Server starting...",
  },
  {
    timestamp: "2026-01-03T09:30:01Z",
    level: "info",
    message: "Loading configuration",
  },
  {
    timestamp: "2026-01-03T09:30:02Z",
    level: "info",
    message: "Connecting to database",
  },
  {
    timestamp: "2026-01-03T09:30:03Z",
    level: "info",
    message: "Database connected",
  },
  {
    timestamp: "2026-01-03T09:30:04Z",
    level: "info",
    message: "Starting HTTP server on :3000",
  },
  { timestamp: "2026-01-03T09:30:05Z", level: "info", message: "Server ready" },
  {
    timestamp: "2026-01-03T09:31:00Z",
    level: "debug",
    message: "Received request: GET /api/health",
  },
  {
    timestamp: "2026-01-03T09:31:00Z",
    level: "info",
    message: "Health check passed",
  },
  {
    timestamp: "2026-01-03T09:32:15Z",
    level: "warn",
    message: "Memory usage above 80%",
  },
  {
    timestamp: "2026-01-03T09:33:00Z",
    level: "debug",
    message: "Running garbage collection",
  },
  {
    timestamp: "2026-01-03T09:33:01Z",
    level: "info",
    message: "GC completed, freed 128MB",
  },
];

const levelColors = {
  debug: "text-biolum-dim",
  info: "text-blue-400",
  warn: "text-yellow-400",
  error: "text-red-400",
};

export function LogsViewer({
  containerId: _containerId,
  className,
}: LogsViewerProps) {
  const scrollRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, []);

  return (
    <div className={cn("flex flex-col bg-void", className)}>
      {/* Search */}
      <div className="border-white/5 border-b p-2">
        <div className="relative">
          <Search className="-translate-y-1/2 absolute top-1/2 left-2 h-4 w-4 text-biolum-dim" />
          <Input
            className="h-8 border-white/10 bg-white/5 pl-8 text-sm"
            placeholder="Search logs..."
          />
        </div>
      </div>

      {/* Logs */}
      <ScrollArea className="flex-1" ref={scrollRef}>
        <div className="p-2 font-mono text-xs">
          {mockLogs.map((log, idx) => (
            <div className="flex gap-2 py-0.5 hover:bg-white/5" key={idx}>
              <span className="flex-shrink-0 text-biolum-faint">
                {new Date(log.timestamp).toLocaleTimeString()}
              </span>
              <span
                className={cn(
                  "w-12 flex-shrink-0",
                  levelColors[log.level as keyof typeof levelColors]
                )}
              >
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
