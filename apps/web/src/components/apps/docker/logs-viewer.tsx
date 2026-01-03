"use client";

/**
 * Logs Viewer - Real-time log streaming
 */

import { Loader2, Search } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import { trpc } from "@/utils/trpc";

type LogsViewerProps = {
  containerId: string;
  className?: string;
};

const levelColors = {
  debug: "text-biolum-dim",
  info: "text-blue-400",
  warn: "text-yellow-400",
  error: "text-red-400",
};

export function LogsViewer({ containerId, className }: LogsViewerProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [searchQuery, setSearchQuery] = useState("");

  // Fetch logs from backend
  const { data, isLoading, error } = trpc.deploy.containersLogs.useQuery(
    { containerId, tail: 200 },
    { refetchInterval: 3000 } // Poll every 3 seconds
  );

  const logs = data?.logs ?? [];

  // Filter logs by search query
  const filteredLogs = searchQuery
    ? logs.filter((log) =>
        log.message.toLowerCase().includes(searchQuery.toLowerCase())
      )
    : logs;

  // Auto-scroll to bottom when logs change
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [filteredLogs.length]);

  return (
    <div className={cn("flex flex-col bg-void", className)}>
      {/* Search */}
      <div className="border-white/5 border-b p-2">
        <div className="relative">
          <Search className="-translate-y-1/2 absolute top-1/2 left-2 h-4 w-4 text-biolum-dim" />
          <Input
            className="h-8 border-white/10 bg-white/5 pl-8 text-sm"
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search logs..."
            value={searchQuery}
          />
        </div>
      </div>

      {/* Logs */}
      <ScrollArea className="flex-1" ref={scrollRef}>
        <div className="p-2 font-mono text-xs">
          {isLoading && (
            <div className="flex items-center justify-center py-4">
              <Loader2 className="h-4 w-4 animate-spin text-biolum-dim" />
            </div>
          )}
          {error && (
            <div className="py-2 text-center text-red-400">
              Failed to load logs
            </div>
          )}
          {!isLoading && filteredLogs.length === 0 && (
            <div className="py-2 text-center text-biolum-dim">No logs</div>
          )}
          {filteredLogs.map((log, idx) => (
            <div className="flex gap-2 py-0.5 hover:bg-white/5" key={idx}>
              <span className="flex-shrink-0 text-biolum-faint">
                {new Date(log.timestamp).toLocaleTimeString()}
              </span>
              <span
                className={cn(
                  "w-12 flex-shrink-0",
                  levelColors[log.level as keyof typeof levelColors] ??
                    "text-biolum-dim"
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
