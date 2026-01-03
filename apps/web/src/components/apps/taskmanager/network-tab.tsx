"use client";

/**
 * Network Tab - Network connections and bandwidth
 */

import { ArrowDown, ArrowUp, Globe, Server } from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";

type NetworkTabProps = {
  className?: string;
};

type Connection = {
  id: string;
  localAddress: string;
  remoteAddress: string;
  protocol: "tcp" | "udp";
  state: "established" | "listening" | "time_wait";
  process: string;
};

// Mock connections
const mockConnections: Connection[] = [
  {
    id: "1",
    localAddress: "127.0.0.1:3000",
    remoteAddress: "0.0.0.0:*",
    protocol: "tcp",
    state: "listening",
    process: "api-server",
  },
  {
    id: "2",
    localAddress: "127.0.0.1:5432",
    remoteAddress: "0.0.0.0:*",
    protocol: "tcp",
    state: "listening",
    process: "postgres",
  },
  {
    id: "3",
    localAddress: "127.0.0.1:52341",
    remoteAddress: "api.openai.com:443",
    protocol: "tcp",
    state: "established",
    process: "codex-agent",
  },
  {
    id: "4",
    localAddress: "127.0.0.1:52342",
    remoteAddress: "api.anthropic.com:443",
    protocol: "tcp",
    state: "established",
    process: "droid-agent",
  },
];

export function NetworkTab({ className }: NetworkTabProps) {
  return (
    <div className={cn("flex flex-col", className)}>
      {/* Bandwidth summary */}
      <div className="flex items-center gap-8 border-white/5 border-b p-4">
        <div className="flex items-center gap-2">
          <ArrowDown className="h-4 w-4 text-green-400" />
          <div>
            <div className="font-semibold text-lg">1.2 MB/s</div>
            <div className="text-biolum-dim text-xs">Download</div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <ArrowUp className="h-4 w-4 text-orange-400" />
          <div>
            <div className="font-semibold text-lg">0.8 MB/s</div>
            <div className="text-biolum-dim text-xs">Upload</div>
          </div>
        </div>
      </div>

      {/* Connection list */}
      <div className="flex items-center gap-4 border-white/5 border-b px-4 py-2 font-medium text-biolum-dim text-xs">
        <span className="w-40">Local Address</span>
        <span className="flex-1">Remote Address</span>
        <span className="w-16">Protocol</span>
        <span className="w-24">State</span>
        <span className="w-24">Process</span>
      </div>

      <ScrollArea className="flex-1">
        {mockConnections.map((conn) => (
          <ConnectionRow connection={conn} key={conn.id} />
        ))}
      </ScrollArea>
    </div>
  );
}

function ConnectionRow({ connection }: { connection: Connection }) {
  const stateColors = {
    established: "text-green-400",
    listening: "text-blue-400",
    time_wait: "text-yellow-400",
  };

  const Icon = connection.remoteAddress.includes("0.0.0.0") ? Server : Globe;

  return (
    <div className="flex items-center gap-4 border-white/5 border-b px-4 py-2 text-sm hover:bg-white/5">
      <span className="w-40 font-mono text-biolum-dim text-xs">
        {connection.localAddress}
      </span>
      <span className="flex flex-1 items-center gap-1 font-mono text-xs">
        <Icon className="h-3 w-3 text-biolum-dim" />
        {connection.remoteAddress}
      </span>
      <span className="w-16 text-biolum-dim text-xs uppercase">
        {connection.protocol}
      </span>
      <span className={cn("w-24 text-xs", stateColors[connection.state])}>
        {connection.state}
      </span>
      <span className="w-24 text-biolum-dim text-xs">{connection.process}</span>
    </div>
  );
}
